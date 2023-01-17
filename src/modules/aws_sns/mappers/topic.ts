import isEqual from 'lodash.isequal';

import {
  SNS,
  CreateTopicCommandInput,
  paginateListTopics,
  SetTopicAttributesCommandInput,
} from '@aws-sdk/client-sns';
import { parse as parseArn } from '@aws-sdk/util-arn-parser';

import { AwsSnsModule } from '..';
import { AWS, crudBuilder2, crudBuilderFormat, paginateBuilder } from '../../../services/aws_macros';
import { Context, Crud2, MapperBase } from '../../interfaces';
import { Topic } from '../entity';

export class TopicMapper extends MapperBase<Topic> {
  module: AwsSnsModule;
  entity = Topic;
  equals = (a: Topic, b: Topic) => {
    return (
      Object.is(a.arn, b.arn) &&
      isEqual(a.contentBasedDeduplication, b.contentBasedDeduplication) &&
      isEqual(a.deliveryPolicy, b.deliveryPolicy) &&
      isEqual(a.displayName, b.displayName) &&
      isEqual(a.fifoTopic, b.fifoTopic) &&
      isEqual(a.kmsMasterKeyId, b.kmsMasterKeyId) &&
      isEqual(a.policy, b.policy) &&
      isEqual(a.signatureVersion, b.signatureVersion) &&
      isEqual(a.tracingConfig, b.tracingConfig) &&
      isEqual(a.dataProtectionPolicy, b.dataProtectionPolicy)
    );
  };

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

  attributeKeys = [
    'contentBasedDeduplication',
    'deliveryPolicy',
    'displayName',
    'kmsMasterKeyId',
    'policy',
    'signatureVersion',
    'tracingConfig',
  ];

  capitalize = (s: string) => {
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  async topicMapper(t: string, region: string, ctx: Context) {
    let out = new Topic();
    if (!t) return undefined;

    // if we have the topic, we can query the attributes and data protection
    const client = (await ctx.getAwsClient(region)) as AWS;
    const attributes = await this.getTopicAttributes(client.snsClient, t);
    if (attributes) {
      for (const key of this.attributeKeys) {
        const transformedKey = this.capitalize(key);
        if (attributes[transformedKey]) {
          const newValues = {
            [key]: attributes[transformedKey],
          };
          out = Object.assign(out, newValues);
        } else {
          const newValues = {
            [key]: undefined,
          };
          out = Object.assign(out, newValues);
        }
      }
      out.fifoTopic = attributes.FifoTopic === 'true';
    }

    const dataProtection = await this.getTopicDataProtection(client.snsClient, t);
    if (dataProtection) out.dataProtectionPolicy = dataProtection;
    else out.dataProtectionPolicy = undefined;

    out.arn = t;
    out.region = region;
    out.name = parseArn(t).resource;
    return out;
  }

  cloud: Crud2<Topic> = new Crud2({
    create: async (es: Topic[], ctx: Context) => {
      const out = [];
      for (const e of es) {
        if (!e.name || !e.region) continue; // cannot create topic without name or region
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        const attr = new Map();
        if (e.fifoTopic) attr.set('FifoTopic', 'true');
        for (const key of this.attributeKeys) {
          if (e.hasOwnProperty(key)) attr.set(this.capitalize(key), e[key as keyof Topic]);
        }

        const input: CreateTopicCommandInput = {
          Name: e.name,
          Attributes: Object.fromEntries(attr),
          DataProtectionPolicy: e.dataProtectionPolicy,
        };
        const result = await this.createTopic(client.snsClient, input);
        if (!result) throw new Error('Error creating SNS topic');

        // update topic with the ARN
        e.arn = result;
        await this.module.topic.db.update(e, ctx);
        out.push(e);
      }
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
      const out = [];
      for (const e of es) {
        let needUpdate = false;
        const cloudRecord = ctx?.memo?.cloud?.Topic?.[this.entityId(e)];

        const isUpdate = this.module.topic.cloud.updateOrReplace(cloudRecord, e) === 'update';
        if (isUpdate) {
          const client = (await ctx.getAwsClient(e.region)) as AWS;

          // if arn or fifo topic is different, we restore it
          if (!Object.is(e.arn, cloudRecord.arn) || !Object.is(e.fifoTopic, cloudRecord.fifoTopic)) {
            cloudRecord.id = e.id;
            await this.module.topic.db.update(cloudRecord, ctx);
            out.push(cloudRecord);
            break;
          }

          // update data protection policy
          if (!isEqual(e.dataProtectionPolicy, cloudRecord.dataProtectionPolicy) && e.dataProtectionPolicy) {
            // update the policy
            await this.putDataProtectionPolicy(client.snsClient, {
              ResourceArn: e.arn,
              DataProtectionPolicy: e.dataProtectionPolicy,
            });
            needUpdate = true;
          }

          for (const key of this.attributeKeys) {
            const dynamicKey = key as keyof Topic;
            if (!isEqual(e[dynamicKey], cloudRecord[dynamicKey])) {
              // if record value is undefined we need to update the DB. If not,
              // update the cloud
              if (!e[dynamicKey]) {
                cloudRecord.id = e.id;
                await this.module.topic.db.update(cloudRecord, ctx);
                break;
              } else {
                const input: SetTopicAttributesCommandInput = {
                  AttributeName: this.capitalize(dynamicKey),
                  AttributeValue: e[dynamicKey] as string,
                  TopicArn: e.arn,
                };

                await this.setTopicAttributes(client.snsClient, input);
                needUpdate = true;
              }
            }
          }

          if (needUpdate) {
            // read the cloud record and update the DB. We need to requery as policy records may
            // have been formatted in a different way
            const updatedRecord = await this.topicMapper(cloudRecord.arn, cloudRecord.region, ctx);
            if (updatedRecord) {
              updatedRecord.id = e.id;
              // Save the record back into the database to get the new fields updated
              await this.module.topic.db.update(updatedRecord, ctx);
              out.push(updatedRecord);
            } else {
              throw new Error('Error updating topic');
            }
          }
        }
      }
      return out;
    },
    delete: async (es: Topic[], ctx: Context) => {
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
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
