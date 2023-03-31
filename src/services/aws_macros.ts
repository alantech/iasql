import { ACM } from '@aws-sdk/client-acm';
import { ApiGatewayV2 } from '@aws-sdk/client-apigatewayv2';
import { AppSync } from '@aws-sdk/client-appsync';
import { CloudFront } from '@aws-sdk/client-cloudfront';
import { CloudWatch } from '@aws-sdk/client-cloudwatch';
import { CloudWatchLogs } from '@aws-sdk/client-cloudwatch-logs';
import { CodeBuild } from '@aws-sdk/client-codebuild';
import { CodeDeploy } from '@aws-sdk/client-codedeploy';
import { CodePipeline } from '@aws-sdk/client-codepipeline';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { EC2 } from '@aws-sdk/client-ec2';
import { ECR } from '@aws-sdk/client-ecr';
import { ECRPUBLIC } from '@aws-sdk/client-ecr-public';
import { ECS } from '@aws-sdk/client-ecs';
import { ElasticLoadBalancingV2 } from '@aws-sdk/client-elastic-load-balancing-v2';
import { ElastiCache } from '@aws-sdk/client-elasticache';
import { IAM } from '@aws-sdk/client-iam';
import { Lambda } from '@aws-sdk/client-lambda';
import { MemoryDB } from '@aws-sdk/client-memorydb';
import { OpenSearch } from '@aws-sdk/client-opensearch';
import { RDS } from '@aws-sdk/client-rds';
import { Route53 } from '@aws-sdk/client-route-53';
import { S3 } from '@aws-sdk/client-s3';
import { SecretsManager } from '@aws-sdk/client-secrets-manager';
import { SNS } from '@aws-sdk/client-sns';
import { SQS } from '@aws-sdk/client-sqs';
import { SSM } from '@aws-sdk/client-ssm';
import { STS } from '@aws-sdk/client-sts';
import { defaultRetryDecider, StandardRetryStrategy } from '@aws-sdk/middleware-retry';

import config from '../config';

export type AWSCreds = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
};

export type AWSConfig = {
  credentials: AWSCreds;
  region: string;
};

// The commented ones below are the "correct" way to do this as far as I can tell from the docs, but
// I have done some weird shit and got it working. Hopefully it doesn't blow up in my face. :/
// type ArgumentTypes<F> = F extends (...args: infer A) => infer _B ? A : never;
// type PromiseReturnType<F> = F extends (...args: any[]) => Promise<infer A> ? A : never;

// To explain the weird shit, I infer the args and the return type, and then I shove them all into
// a array of types.
type ArgumentTypes<F> = F extends (...args: infer A) => infer B ? [...A, B] : never;
// There is no way to access "end of array", though. The numbers are "magic" and I hope they don't
// break.
type PromiseReturnType<F> = ArgumentTypes<ArgumentTypes<F>[2]>[1];

// defaults for slow retries
const SLOW_STRATEGY_RETRIES = 10; // retry a max of 10 times, it will allow to bypass quotas
const SLOW_STRATEGY_BASE_DELAY = 1000; // wait 1 second - as only delete api has a 5 second quota
const SLOW_STRATEGY_MAXIMUM_RETRY_DELAY = 20 * 5000;

export class AWS {
  acmClient: ACM;
  apiGatewayClient: ApiGatewayV2;
  appSyncClient: AppSync;
  cbClient: CodeBuild;
  cdClient: CodeDeploy;
  cpClient: CodePipeline;
  cwClient: CloudWatchLogs;
  cloudwatchClient: CloudWatch; // need to add a different wording as cwClient is taken
  ec2client: EC2;
  ecrClient: ECR;
  ecrPubClient: ECRPUBLIC;
  ecsClient: ECS;
  elbClient: ElasticLoadBalancingV2;
  iamClient: IAM;
  rdsClient: RDS;
  region: string;
  route53Client: Route53;
  s3Client: S3;
  snsClient: SNS;
  stsClient: STS;
  sqsClient: SQS;
  ssmClient: SSM;
  dynamoClient: DynamoDB;
  lambdaClient: Lambda;
  elasticacheClient: ElastiCache;
  secretsClient: SecretsManager;
  cloudfrontClient: CloudFront;
  memoryDBClient: MemoryDB;
  opensearchClient: OpenSearch;
  slowRetryStrategy: StandardRetryStrategy;
  codeBuildRetryStrategy: StandardRetryStrategy;

  constructor(awsConfig: AWSConfig) {
    // declare a specific slow retry strategy, to reuse in slow apis
    this.slowRetryStrategy = new StandardRetryStrategy(async () => SLOW_STRATEGY_RETRIES, {
      retryDecider: error => {
        // copied the default behavior from aws-sdk to fix the problem caused by Jest on isRetryableByTrait
        if (!error) {
          return false;
        }
        if (!!config.overrideAwsRetryDecider && error.message.includes('AWS SDK error wrapper')) {
          // jest has messed the error object
          return true;
        }
        // default behavior when running outside Jest
        return defaultRetryDecider(error);
      },
      delayDecider: (_, attempts) =>
        Math.floor(
          Math.min(
            SLOW_STRATEGY_MAXIMUM_RETRY_DELAY,
            Math.random() * 2 ** attempts * SLOW_STRATEGY_BASE_DELAY,
          ),
        ),
    });
    // Get around some strange internal caching inside of codebuild of the IAM roles
    this.codeBuildRetryStrategy = new StandardRetryStrategy(async () => SLOW_STRATEGY_RETRIES, {
      retryDecider: sdkErr =>
        sdkErr.message.includes('CodeBuild is not authorized to perform: sts:AssumeRole'),
      delayDecider: (_, attempts) =>
        Math.floor(
          Math.min(
            SLOW_STRATEGY_MAXIMUM_RETRY_DELAY,
            Math.random() * 2 ** attempts * SLOW_STRATEGY_BASE_DELAY,
          ),
        ),
    });

    this.region = awsConfig.region;
    this.apiGatewayClient = new ApiGatewayV2({
      credentials: awsConfig.credentials,
      region: awsConfig.region,
      retryStrategy: this.slowRetryStrategy,
    });
    this.acmClient = new ACM({
      ...awsConfig,
      retryStrategy: this.slowRetryStrategy,
    });
    this.appSyncClient = new AppSync(awsConfig);
    this.cloudfrontClient = new CloudFront(awsConfig);
    this.cbClient = new CodeBuild({
      credentials: awsConfig.credentials,
      region: awsConfig.region,
      retryStrategy: this.codeBuildRetryStrategy,
    });
    this.cdClient = new CodeDeploy(awsConfig);
    this.cpClient = new CodePipeline(awsConfig);
    this.cwClient = new CloudWatchLogs(awsConfig);
    this.cloudwatchClient = new CloudWatch(awsConfig);
    this.dynamoClient = new DynamoDB(awsConfig);
    this.elasticacheClient = new ElastiCache(awsConfig);
    this.ec2client = new EC2(awsConfig);
    this.ecrClient = new ECR(awsConfig);
    this.ecsClient = new ECS(awsConfig);
    this.elbClient = new ElasticLoadBalancingV2(awsConfig);
    this.iamClient = new IAM({
      credentials: awsConfig.credentials,
      region: awsConfig.region,
      retryStrategy: this.slowRetryStrategy,
    });
    this.lambdaClient = new Lambda({
      ...awsConfig,
      retryStrategy: this.slowRetryStrategy,
    });
    this.rdsClient = new RDS(awsConfig);
    this.route53Client = new Route53(awsConfig);
    this.secretsClient = new SecretsManager(awsConfig);
    this.snsClient = new SNS(awsConfig);
    this.sqsClient = new SQS(awsConfig);
    this.stsClient = new STS(awsConfig);
    this.ssmClient = new SSM(awsConfig);
    this.memoryDBClient = new MemoryDB(awsConfig);
    this.opensearchClient = new OpenSearch(awsConfig);
    this.s3Client = new S3(awsConfig);
    // Service endpoint only available in 'us-east-1' https://docs.aws.amazon.com/general/latest/gr/ecr-public.html
    this.ecrPubClient = new ECRPUBLIC({ credentials: awsConfig.credentials, region: 'us-east-1' });
  }
}

export function paginateBuilder<T>(
  paginateFn: (...args: any[]) => any,
  propName: string,
  pageName?: string,
  pageSize = 25,
  argMapper?: (...args: any[]) => Object,
): (client: T, ...args: any[]) => Promise<any[]> {
  if (pageName) {
    return async (client: any, ...args: any[]) => {
      const vals = [];
      const paginator = paginateFn(
        {
          client,
          pageSize,
        },
        argMapper?.(...args) ?? {},
      );
      for await (const page of paginator) {
        for (const r of page[pageName] ?? []) {
          vals.push(...(r[propName] ?? []));
        }
      }
      return vals;
    };
  } else {
    return async (client: any, ...args: any[]) => {
      const vals = [];
      const paginator = paginateFn(
        {
          client,
          pageSize,
        },
        argMapper?.(...args) ?? {},
      );
      for await (const page of paginator) {
        vals.push(...(page[propName] ?? []));
      }
      return vals;
    };
  }
}

export function crudBuilderFormat<T, U extends keyof T, V>(
  methodName: U,
  argMapper: (...args: any[]) => ArgumentTypes<T[U]>[0],
  retFormatter: (arg0: PromiseReturnType<T[U]>, ...args: any[]) => V,
) {
  return async (client: T, ...args: any[]): Promise<V> =>
    retFormatter(
      (await (client[methodName] as T[U] extends Function ? T[U] : any)(
        argMapper(...args),
      )) as PromiseReturnType<T[U]>,
      ...args,
    );
}

export function crudBuilder<T, U extends keyof T>(
  methodName: U,
  argMapper: (...args: any[]) => ArgumentTypes<T[U]>[0],
) {
  return async (client: T, ...args: any[]): Promise<PromiseReturnType<T[U]>> =>
    await (client[methodName] as any)(argMapper(...args));
}

export async function mapLin(
  arrProm: any[] | Promise<any[] | undefined>,
  mapper: (arg: any) => Promise<any>,
): Promise<any[]> {
  const out = [];
  const inp = await arrProm;
  if (inp) {
    for (const val of inp) {
      out.push(await mapper(val));
    }
  }
  return out;
}

export function eqTags(a: { [key: string]: string } | undefined, b: { [key: string]: string } | undefined) {
  return (
    Object.is(Object.keys(a ?? {})?.length, Object.keys(b ?? {})?.length) &&
    Object.keys(a ?? {})?.every(ak => (a ?? {})[ak] === (b ?? {})[ak])
  );
}
