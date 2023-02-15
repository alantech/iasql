import isEqual from 'lodash.isequal';

import {
  CreateQueueCommandInput,
  GetQueueAttributesCommandInput,
  paginateListQueues,
  SQS,
} from '@aws-sdk/client-sqs';
import { ListQueuesCommandInput } from '@aws-sdk/client-sqs/dist-types/commands/ListQueuesCommand';
import { parse as parseArn } from '@aws-sdk/util-arn-parser';
import { createWaiter, WaiterState } from '@aws-sdk/util-waiter';

import { policiesAreSame } from '../../../services/aws-diff';
import { AWS, crudBuilder2, crudBuilderFormat, paginateBuilder } from '../../../services/aws_macros';
import { Context, Crud2, MapperBase } from '../../interfaces';
import { Queue } from '../entity';
import { AwsSqsModule } from '../index';

export class QueueMapper extends MapperBase<Queue> {
  module: AwsSqsModule;
  entity = Queue;

  getQueueAttributes = crudBuilderFormat<SQS, 'getQueueAttributes', Record<string, string> | undefined>(
    'getQueueAttributes',
    queueUrl => ({
      AttributeNames: ['All'],
      QueueUrl: queueUrl,
    }),
    res => res?.Attributes,
  );
  getQueues = paginateBuilder<SQS>(paginateListQueues, 'QueueUrls');
  createQueue = crudBuilderFormat<SQS, 'createQueue', string | undefined>(
    'createQueue',
    input => input,
    res => res?.QueueUrl,
  );
  setQueueAttributes = crudBuilder2<SQS, 'setQueueAttributes'>('setQueueAttributes', input => input);
  deleteQueue = crudBuilder2<SQS, 'deleteQueue'>('deleteQueue', QueueUrl => ({ QueueUrl }));

  equals = (a: Queue, b: Queue) => {
    return (
      isEqual(a.name, b.name) &&
      isEqual(a.fifoQueue, b.fifoQueue) &&
      isEqual(a.visibilityTimeout, b.visibilityTimeout) &&
      isEqual(a.delaySeconds, b.delaySeconds) &&
      isEqual(a.receiveMessageWaitTimeSeconds, b.receiveMessageWaitTimeSeconds) &&
      isEqual(a.messageRetentionPeriod, b.messageRetentionPeriod) &&
      isEqual(a.maximumMessageSize, b.maximumMessageSize) &&
      policiesAreSame(a.policy, b.policy)
    );
  };

  async queueMapper(queueUrl: string, region: string, client: SQS) {
    const out: Queue = new Queue();
    out.url = queueUrl;
    const queueAttributes = await this.getQueueAttributes(client, queueUrl);
    if (!queueAttributes) throw new Error(`Cannot get queue attributes for ${queueUrl}`);
    // https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/API_GetQueueAttributes.html
    out.url = queueUrl;
    out.name = parseArn(queueAttributes.QueueArn).resource;
    out.fifoQueue = out.name.endsWith('.fifo');
    out.visibilityTimeout = parseInt(queueAttributes.VisibilityTimeout, 10);
    out.delaySeconds = parseInt(queueAttributes.DelaySeconds, 10);
    out.receiveMessageWaitTimeSeconds = parseInt(queueAttributes.ReceiveMessageWaitTimeSeconds, 10);
    out.messageRetentionPeriod = parseInt(queueAttributes.MessageRetentionPeriod, 10);
    out.maximumMessageSize = parseInt(queueAttributes.MaximumMessageSize, 10);
    out.policy = JSON.parse(queueAttributes.Policy);
    out.arn = queueAttributes.QueueArn;
    out.region = region;

    return out;
  }

  private createAttributesObject(e: Queue) {
    const attributes: Record<string, string> = {
      VisibilityTimeout: e.visibilityTimeout.toString(),
      DelaySeconds: e.delaySeconds.toString(),
      ReceiveMessageWaitTimeSeconds: e.receiveMessageWaitTimeSeconds.toString(),
      MessageRetentionPeriod: e.messageRetentionPeriod.toString(),
      MaximumMessageSize: e.maximumMessageSize.toString(),
      Policy: JSON.stringify(e.policy),
    };
    if (e.fifoQueue) attributes.FifoQueue = 'true'; // https://github.com/aws/aws-cdk/issues/8550
    return attributes;
  }

  async creationWaiter(client: SQS, queueName: string, queueUrl: string) {
    // first, we should wait for the queue url to show up in the list
    // no input other than QueueNamePrefix is accepted - and the response has no name in it, so this is the best shot
    await createWaiter<SQS, ListQueuesCommandInput>(
      {
        client,
        maxWaitTime: 300,
        minDelay: 1,
        maxDelay: 4,
      },
      {},
      async (cl) => {
        try {
          const queueUrls = await this.getQueues(cl);
          if (queueUrls.includes(queueUrl)) return { state: WaiterState.SUCCESS };
          return { state: WaiterState.RETRY };
        } catch (e: any) {
          return { state: WaiterState.RETRY };
        }
      },
    );

    // now we should make sure the queue attributes are available
    const getAttributesInput: GetQueueAttributesCommandInput = {
      QueueUrl: queueUrl,
      AttributeNames: ['All'],
    };
    await createWaiter<SQS, GetQueueAttributesCommandInput>(
      {
        client,
        maxWaitTime: 300,
        minDelay: 1,
        maxDelay: 4,
      },
      getAttributesInput,
      async (cl, cmd) => {
        try {
          const data = await cl.getQueueAttributes(cmd);
          if (!data.Attributes) return { state: WaiterState.RETRY };
          if (!!data.Attributes.QueueArn) return { state: WaiterState.SUCCESS };
          return { state: WaiterState.RETRY };
        } catch (e: any) {
          return { state: WaiterState.RETRY };
        }
      },
    );
  }

  cloud: Crud2<Queue> = new Crud2<Queue>({
    create: async (es: Queue[], ctx: Context) => {
      const out = [];
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        const input: CreateQueueCommandInput = {
          QueueName: e.name,
          Attributes: this.createAttributesObject(e),
        };
        const queueUrl = await this.createQueue(client.sqsClient, input);
        if (!queueUrl) throw new Error('Cannot create queue');
        await this.creationWaiter(client.sqsClient, e.name, queueUrl);
        const queueAttributes = await this.getQueueAttributes(client.sqsClient, queueUrl);
        e.arn = queueAttributes!.QueueArn;
        e.url = queueUrl;
        e.policy = JSON.parse(queueAttributes!.Policy); // AWS changes the policy we submit, this is to avoid failures in apply
        await this.module.queue.db.update(e, ctx);
        out.push(e);
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];
      if (!!id) {
        const { url, region } = this.idFields(id);
        const client = (await ctx.getAwsClient(region)) as AWS;
        return this.queueMapper(url, region, client.sqsClient);
      } else {
        const out: Queue[] = [];
        await Promise.all(
          enabledRegions.map(async region => {
            const client = (await ctx.getAwsClient(region)) as AWS;
            const queueUrls = await this.getQueues(client.sqsClient);
            for (const queueUrl of queueUrls) {
              try {
                const queue = await this.queueMapper(queueUrl, region, client.sqsClient);
                out.push(queue);
              } catch (e: any) {
                // the queue is recently created/deleted, so it shows up in getQueues but not here
              }
            }
          }),
        );
        return out;
      }
    },
    updateOrReplace: (prev: Queue, next: Queue) => {
      if (prev.name !== next.name || prev.fifoQueue !== next.fifoQueue) return 'replace';
      return 'update';
    },
    update: async (es: Queue[], ctx) => {
      const out: Queue[] = [];
      for (const e of es) {
        const cloudRecord: Queue = ctx?.memo?.cloud?.Queue?.[this.entityId(e)];
        if (cloudRecord.arn !== e.arn) {
          // just write back arn with the cloud value
          e.arn = cloudRecord.arn;
          await this.module.queue.db.update(e, ctx);
        }

        if (this.module.queue.cloud.updateOrReplace(cloudRecord, e) === 'replace') {
          await this.module.queue.cloud.delete(cloudRecord, ctx);
          // You must wait 60 seconds after deleting a queue before you can create another queue with the same name.
          if (cloudRecord.name === e.name) await new Promise(resolve => setTimeout(resolve, 61 * 1000));
          await this.module.queue.cloud.create(e, ctx);
        } else {
          const client = (await ctx.getAwsClient(e.region)) as AWS;
          await this.setQueueAttributes(client.sqsClient, {
            QueueUrl: e.url,
            Attributes: this.createAttributesObject(e),
          });
          out.push(e);
        }
      }
      return out;
    },
    delete: async (es: Queue[], ctx: Context) => {
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        await this.deleteQueue(client.sqsClient, e.url);
      }
    },
  });

  constructor(module: AwsSqsModule) {
    super();
    this.module = module;
    super.init();
  }
}
