import { ACM, } from '@aws-sdk/client-acm'
import { CloudWatchLogs, } from '@aws-sdk/client-cloudwatch-logs'
import { EC2, } from '@aws-sdk/client-ec2'
import { ECR, } from '@aws-sdk/client-ecr'
import { ECRPUBLIC, } from '@aws-sdk/client-ecr-public'
import { ECS, } from '@aws-sdk/client-ecs'
import { ElasticLoadBalancingV2, } from '@aws-sdk/client-elastic-load-balancing-v2'
import { IAM, } from '@aws-sdk/client-iam'
import { RDS, } from '@aws-sdk/client-rds'
import { Route53, } from '@aws-sdk/client-route-53'
import { S3, } from '@aws-sdk/client-s3'

type AWSCreds = {
  accessKeyId: string,
  secretAccessKey: string
}

type AWSConfig = {
  credentials: AWSCreds,
  region: string
}

export class AWS {
  acmClient: ACM
  cwClient: CloudWatchLogs
  ec2client: EC2
  ecrClient: ECR
  ecrPubClient: ECRPUBLIC
  ecsClient: ECS
  elbClient: ElasticLoadBalancingV2
  iamClient: IAM
  rdsClient: RDS
  region: string
  route53Client: Route53
  s3Client: S3

  constructor(config: AWSConfig) {
    this.region = config.region;
    this.ec2client = new EC2(config);
    this.ecrClient = new ECR(config);
    this.elbClient = new ElasticLoadBalancingV2(config);
    this.ecsClient = new ECS(config);
    this.rdsClient = new RDS(config);
    this.cwClient = new CloudWatchLogs(config);
    this.route53Client = new Route53(config);
    this.iamClient = new IAM(config);
    this.acmClient = new ACM(config);
    // Technically available in multiple regions but with weird constraints, and the default is us-east-1
    this.s3Client = new S3({ ...config, region: 'us-east-1', });
    // Service endpoint only available in 'us-east-1' https://docs.aws.amazon.com/general/latest/gr/ecr-public.html
    this.ecrPubClient = new ECRPUBLIC({credentials: config.credentials, region: 'us-east-1'});
  }
}

export function paginateBuilder<T>(
  paginateFn: (...args: any[]) => any,
  propName: string,
  pageName?: string,
  pageSize = 25
): ((client: T) => Promise<any[]>) {
  if (pageName) {
    return async (client: any) => {
      const vals = [];
      const paginator = paginateFn({
        client,
        pageSize,
      }, {});
      for await (const page of paginator) {
        for (const r of page[pageName] ?? []) {
          vals.push(...(r[propName] ??[]));
        }
      }
      return vals;
    };
  } else {
    return async (client: any) => {
      const vals = [];
      const paginator = paginateFn({
        client,
        pageSize,
      }, {});
      for await (const page of paginator) {
        vals.push(...(page[propName] ??[]));
      }
      return vals;
    };
  }
}

export function crudBuilder<T>(
  methodName: keyof T,
  argMapper: (...args: any[]) => any,
  retFormatter?: (arg0: any, ...args: any[]) => any
): ((client: T, ...args: any[]) => Promise<any>) {
  if (retFormatter) {
    return async (client: any, ...args: any[]) => retFormatter(
      await client[methodName](argMapper(...args)),
      ...args
    );
  } else {
    return async (client: any, ...args: any[]) => await client[methodName](argMapper(...args));
  }
}

export async function mapLin(arrProm: any[] | Promise<any[] | undefined>, mapper: (arg: any) => Promise<any>): Promise<any[]> {
  const out = [];
  const inp = await arrProm;
  if (inp) {
    for (const val of inp) {
      out.push(await mapper(val));
    }
  }
  return out;
}
