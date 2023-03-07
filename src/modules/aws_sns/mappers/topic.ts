import isEqual from 'lodash.isequal';

import {
  SNS,
  CreateTopicCommandInput,
  paginateListTopics,
  SetTopicAttributesCommandInput,
} from '@aws-sdk/client-sns';
import { parse as parseArn } from '@aws-sdk/util-arn-parser';

import { AwsSnsModule } from '..';
import { AWS, crudBuilder, crudBuilderFormat, paginateBuilder } from '../../../services/aws_macros';
import { Context, Crud, MapperBase } from '../../interfaces';
import { Topic } from '../entity';

export class TopicMapper extends MapperBase<Topic> {
  module: AwsSnsModule;
  entity = Topic;
  equals = (a: Topic, b: Topic) => {
    return (
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

  setTopicAttributes = crudBuilder<SNS, 'setTopicAttributes'>('setTopicAttributes', input => input);

  putDataProtectionPolicy = crudBuilder<SNS, 'putDataProtectionPolicy'>(
    'putDataProtectionPolicy',
    input => input,
  );

  deleteTopic = crudBuilder<SNS, 'deleteTopic'>('deleteTopic', TopicArn => ({
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

  async topicMapper(arn: string, region: string, ctx: Context) {
    if (!arn) return undefined;
    let out = new Topic();

    // if we have the topic, we can query the attributes and data protection
    const client = (await ctx.getAwsClient(region)) as AWS;
    const attributes = await this.getTopicAttributes(client.snsClient, arn);
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

    // if not fifo, get data protection
    out.dataProtectionPolicy = undefined;
    if (!out.fifoTopic) {
      const dataProtection = await this.getTopicDataProtection(client.snsClient, arn);
      if (dataProtection) out.dataProtectionPolicy = dataProtection;
    }

    out.arn = arn;
    out.region = region;
    out.name = parseArn(arn).resource;
    return out;
  }

  cloud: Crud<Topic> = new Crud({
    create: async (es: Topic[], ctx: Context) => {
      const out = [];
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        const attr = new Map();
        if (e.fifoTopic) {
          attr.set('FifoTopic', 'true');
          e.dataProtectionPolicy = undefined;
        }
        for (const key of this.attributeKeys) {
          if (e.hasOwnProperty(key)) attr.set(this.capitalize(key), e[key as keyof Topic]);
        }

        const input: CreateTopicCommandInput = {
          Name: e.name,
          Attributes: Object.fromEntries(attr),
          DataProtectionPolicy: e.dataProtectionPolicy,
        };
        const arn = await this.createTopic(client.snsClient, input);
        if (!arn) throw new Error('Error creating SNS topic');

        // update topic with the ARN
        e.arn = arn;
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
          // we retrieve topic attributes and policy
          return await this.topicMapper(arn, region, ctx);
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
          // if data protection policy is set and is fifo topic, we restore it
          if (
            !Object.is(e.arn, cloudRecord.arn) ||
            !Object.is(e.fifoTopic, cloudRecord.fifoTopic) ||
            (e.fifoTopic && e.dataProtectionPolicy)
          ) {
            cloudRecord.id = e.id;
            await this.module.topic.db.update(cloudRecord, ctx);
            out.push(cloudRecord);
            continue;
          }

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
