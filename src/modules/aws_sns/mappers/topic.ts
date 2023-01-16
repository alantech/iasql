import isEqual from 'lodash.isequal';

import { SNS, Topic as TopicAws, CreateTopicCommandInput, paginateListTopics } from '@aws-sdk/client-sns';
import { parse as parseArn } from '@aws-sdk/util-arn-parser';

import { AwsSnsModule } from '..';
import { AWS, crudBuilder2, crudBuilderFormat, paginateBuilder } from '../../../services/aws_macros';
import { Context, Crud2, MapperBase } from '../../interfaces';
import { Topic } from '../entity';

// compares two objects and get the keys of the values that are different
function getObjectDiff(obj1: Record<string, string>, obj2: Record<string, string>) {
  const diff = Object.keys(obj1).reduce((result, key) => {
    if (!obj2.hasOwnProperty(key)) {
      result.push(key);
    } else if (isEqual(obj1[key], obj2[key])) {
      const resultKeyIndex = result.indexOf(key);
      result.splice(resultKeyIndex, 1);
    }
    return result;
  }, Object.keys(obj2));

  return diff;
}

export class TopicMapper extends MapperBase<Topic> {
  module: AwsSnsModule;
  entity = Topic;
  equals = (a: Topic, b: Topic) =>
    Object.is(a.arn, b.arn) &&
    isEqual(a.attributes, b.attributes) &&
    isEqual(a.dataProtectionPolicy, b.dataProtectionPolicy);

  getTopicAttributes = crudBuilderFormat<SNS, 'getTopicAttributes', Record<string, string> | undefined>(
    'getTopicAttributes',
    arn => ({ TopicArn: arn }),
    res => res?.Attributes,
  );

  getTopicDataProtection = crudBuilderFormat<SNS, 'getDataProtectionPolicy', string | undefined>(
    'getDataProtectionPolicy',
    arn => ({ ResourceArn: arn }),
    res => res?.DataProtectionPolicy,
  );

  createTopic = crudBuilderFormat<SNS, 'createTopic', string | undefined>(
    'createTopic',
    input => input,
    res => res?.TopicArn,
  );

  getTopics = paginateBuilder<SNS>(paginateListTopics, 'Topics', undefined, undefined);

  setTopicAttributes = crudBuilder2<SNS, 'setTopicAttributes'>('setTopicAttributes', input => input);

  putDataProtectionPolicy = crudBuilder2<SNS, 'putDataProtectionPolicy'>(
    'putDataProtectionPolicy',
    input => input,
  );

  deleteTopic = crudBuilder2<SNS, 'deleteTopic'>('deleteTopic', TopicArn => ({
    TopicArn,
  }));

  async topicMapper(t: string, region: string, ctx: Context) {
    const out = new Topic();
    if (!t) return undefined;

    // if we have the topic, we can query the attributes and data protection
    const client = (await ctx.getAwsClient(region)) as AWS;
    const attributes = await this.getTopicAttributes(client.snsClient, t);
    if (attributes) out.attributes = attributes;
    const dataProtection = await this.getTopicDataProtection(client.snsClient, t);
    if (dataProtection) out.dataProtectionPolicy = dataProtection;
    else out.dataProtectionPolicy = undefined;
    out.arn = t;
    out.region = region;

    // name needs to be extracted from ARN
    out.name = parseArn(t).resource;
    return out;
  }

  cloud: Crud2<Topic> = new Crud2({
    create: async (es: Topic[], ctx: Context) => {
      const out = [];
      for (const e of es) {
        if (!e.name || !e.region) continue; // cannot create topic without name or region
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        const input: CreateTopicCommandInput = {
          Name: e.name,
          Attributes: e.attributes as unknown as Record<string, string>,
          DataProtectionPolicy: e.dataProtectionPolicy,
        };
        const result = await this.createTopic(client.snsClient, input);
        if (!result) throw new Error('Error creating SNS topic');

        // update topic with the ARN
        e.arn = result;
        console.log('final record is');
        console.log(e);
        await this.module.topic.db.update(e, ctx);
        out.push(e);
      }
      console.log('records are');
      console.log(out);
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];
      if (!!id) {
        const { arn, region } = this.idFields(id);
        if (enabledRegions.includes(region)) {
          const client = (await ctx.getAwsClient(region)) as AWS;

          // we retrieve topic attributes and policy
          const entry = await this.topicMapper(arn, region, ctx);
          return entry;
        }
      } else {
        const out: Topic[] = [];
        await Promise.all(
          enabledRegions.map(async region => {
            const client = (await ctx.getAwsClient(region)) as AWS;
            const topics = (await this.getTopics(client.snsClient)) ?? [];
            for (const topic of topics) {
              const mappedTopic = await this.topicMapper(topic.TopicArn, region, ctx);
              if (mappedTopic) out.push(mappedTopic);
            }
          }),
        );
        return out;
      }
    },
    updateOrReplace: (prev: Topic, next: Topic) => 'update',
    update: async (es: Topic[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      const out = [];
      for (const e of es) {
        const cloudRecord = ctx?.memo?.cloud?.Topic?.[this.entityId(e)];
        const isUpdate = this.module.topic.cloud.updateOrReplace(cloudRecord, e) === 'update';
        if (isUpdate) {
          // if arn is different, we restore it
          if (!Object.is(e.arn, cloudRecord.arn)) {
            cloudRecord.id = e.id;
            await this.module.topic.db.update(cloudRecord, ctx);
            out.push(cloudRecord);
            continue;
          }

          // check if the attributes are different and get the modified ones
          if (!isEqual(e.attributes, cloudRecord.attributes)) {
            const diff = getObjectDiff(e.attributes as Record<string, string>, cloudRecord.attributes);
            for (const key of diff) {
              // check if the key is on cloudRecord and use that, otherwise set as null
              let value;
              if (cloudRecord.hasOwnProperty(key)) value = cloudRecord[key];

              // update attribute
              await this.setTopicAttributes(client.snsClient, {
                AttributeName: key,
                AttributeValue: value,
                TopicArn: cloudRecord.arn,
              });
            }
          }
          if (!isEqual(e.dataProtectionPolicy, cloudRecord.dataProtectionPolicy)) {
            // update tye policy
            await this.putDataProtectionPolicy(client.snsClient, {
              ResourceArn: cloudRecord.arn,
              DataProtectionPolicy: cloudRecord.dataProtectionPolicy,
            });
          }
          out.push(cloudRecord);
        }
      }
      return out;
    },
    delete: async (es: Topic[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      for (const e of es) {
        await this.deleteTopic(client.snsClient, e.arn);
      }
    },
  });

  constructor(module: AwsSnsModule) {
    super();
    this.module = module;
    super.init();
  }
}
