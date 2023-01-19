import {
  paginateListSubscriptions,
  paginateListSubscriptionsByTopic,
  SNS,
  Subscription as SubscriptionAWS,
} from '@aws-sdk/client-sns';

import { AwsSnsModule } from '..';
import { AWS, paginateBuilder } from '../../../services/aws_macros';
import { Context, Crud2, MapperBase } from '../../interfaces';
import { Subscription } from '../entity/subscription';

export class SubscriptionMapper extends MapperBase<Subscription> {
  module: AwsSnsModule;
  entity = Subscription;
  equals = (a: Subscription, b: Subscription) => {
    return Object.is(a.arn, b.arn) && Object.is(a.endpoint, b.endpoint) && Object.is(a.protocol, b.protocol);
  };

  async subscriptionMapper(s: SubscriptionAWS, region: string, ctx: Context) {
    const out = new Subscription();
    if (!s.SubscriptionArn || !s.Protocol || !s.TopicArn) return undefined;

    out.arn = s.SubscriptionArn;
    out.endpoint = s.Endpoint;
    out.protocol = s.Protocol;
    out.region = region;

    // read topic from ARN
    try {
      out.topic =
        (await this.module.topic.db.read(
          ctx,
          this.module.topic.generateId({ arn: s.TopicArn ?? '', region }),
        )) ??
        (await this.module.topic.cloud.read(
          ctx,
          this.module.topic.generateId({ arn: s.TopicArn ?? '', region }),
        ));
    } catch (e) {
      // for non-confirmed subscriptions, topic may not exist, so do not map it
      return undefined;
    }

    return out;
  }

  listSubscriptionsByTopic = paginateBuilder<SNS>(
    paginateListSubscriptionsByTopic,
    'listSubscriptionsByTopic',
    undefined,
    undefined,
    topicArn => ({ TopicArn: topicArn }),
  );

  listSubscriptions = paginateBuilder<SNS>(paginateListSubscriptions, 'Subscriptions');

  cloud: Crud2<Subscription> = new Crud2({
    create: async (es: Subscription[], ctx: Context) => {},
    read: async (ctx: Context, id?: string) => {
      const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];
      if (!!id) {
        const { topic, endpoint, region } = this.idFields(id);

        if (enabledRegions.includes(region)) {
          const client = (await ctx.getAwsClient(region)) as AWS;

          // retrieve all subscriptions and find the right one
          const subscriptions = await this.listSubscriptionsByTopic(client.snsClient, topic);
          for (const subscription of subscriptions) {
            if (subscription.Endpoint === endpoint) {
              const entry = await this.subscriptionMapper(subscription, region, ctx);
              return entry;
            }
          }
        }
      } else {
        const out: Subscription[] = [];
        await Promise.all(
          enabledRegions.map(async region => {
            const client = (await ctx.getAwsClient(region)) as AWS;
            const subs = (await this.listSubscriptions(client.snsClient)) ?? [];
            for (const s of subs) {
              const mappedSubscription = await this.subscriptionMapper(s, region, ctx);
              if (mappedSubscription) out.push(mappedSubscription);
            }
          }),
        );

        return out;
      }
    },
    update: async (es: Subscription[], ctx: Context) => {},
    delete: async (es: Subscription[], ctx: Context) => {},
  });

  constructor(module: AwsSnsModule) {
    super();
    this.module = module;
    super.init();
  }
}
