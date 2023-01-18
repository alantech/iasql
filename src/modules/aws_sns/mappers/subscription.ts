import {
  paginateListSubscriptions,
  paginateListSubscriptionsByTopic,
  SNS,
  Subscription as SubscriptionAWS,
} from '@aws-sdk/client-sns';

import { AwsSnsModule } from '..';
import { AWS, crudBuilder2, crudBuilderFormat, paginateBuilder } from '../../../services/aws_macros';
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
    out.topic =
      (await this.module.topic.db.read(
        ctx,
        this.module.topic.generateId({ arn: s.TopicArn ?? '', region }),
      )) ??
      (await this.module.topic.cloud.read(
        ctx,
        this.module.topic.generateId({ arn: s.TopicArn ?? '', region }),
      ));

    return out;
  }

  createSubscription = crudBuilderFormat<SNS, 'subscribe', string | undefined>(
    'subscribe',
    input => input,
    res => res?.SubscriptionArn,
  );

  listSubscriptionsByTopic = paginateBuilder<SNS>(
    paginateListSubscriptionsByTopic,
    'listSubscriptionsByTopic',
    undefined,
    undefined,
    topicArn => ({ TopicArn: topicArn }),
  );

  listSubscriptions = paginateBuilder<SNS>(paginateListSubscriptions, 'Subscriptions');

  deleteSubscription = crudBuilder2<SNS, 'unsubscribe'>('unsubscribe', SubscriptionArn => ({
    SubscriptionArn,
  }));

  cloud: Crud2<Subscription> = new Crud2({
    create: async (es: Subscription[], ctx: Context) => {
      const out = [];
      for (const e of es) {
        if (!e.protocol || !e.topic || !e.region) continue; // cannot create topic without protocol or topic or region
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        const result = await this.createSubscription(client.snsClient, {
          Endpoint: e.endpoint,
          Protocol: e.protocol,
          ReturnsSubscriptionArn: true,
          TopicArn: e.topic.arn,
        });
        if (!result) throw new Error('Error creating SNS subscription');

        // update subscription with the ARN
        e.arn = result;
        await this.module.subscription.db.update(e, ctx);
        out.push(e);
      }
      return out;
    },
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
    updateOrReplace: (prev: Subscription, next: Subscription) => {
      if (!Object.is(prev.arn, next.arn) || prev.arn === 'PendingConfirmation') return 'update';
      else return 'replace';
    },
    update: async (es: Subscription[], ctx: Context) => {
      const out = [];
      for (const e of es) {
        const cloudRecord = ctx?.memo?.cloud?.Subscription?.[this.entityId(e)];

        const isUpdate = this.module.subscription.cloud.updateOrReplace(cloudRecord, e) === 'update';
        if (isUpdate) {
          const client = (await ctx.getAwsClient(e.region)) as AWS;

          // we need to restore values, no means of updating a subscription
          cloudRecord.id = e.id;
          await this.module.subscription.db.update(cloudRecord, ctx);
          out.push(cloudRecord);
        } else {
          // we create a new entry
          const newSubscription = await this.module.subscription.cloud.create(e, ctx);
          await this.module.subscription.cloud.delete(cloudRecord, ctx);
          out.push(newSubscription);
        }
      }
      return out;
    },
    delete: async (es: Subscription[], ctx: Context) => {
      for (const e of es) {
        if (e.arn === 'PendingConfirmation') {
          throw new Error(
            'Cannot delete a subscription pending from confirmation. You either need to confirm it, or it will be removed automatically after 3 days.',
          );
        } // cannot delete those as they need to be confirmed
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        await this.deleteSubscription(client.snsClient, e.arn);
      }
    },
  });

  constructor(module: AwsSnsModule) {
    super();
    this.module = module;
    super.init();
  }
}
