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

export function crudBuilderFormat<T, U extends keyof T, V>(
  methodName: U,
  argMapper: (...args: any[]) => ArgumentTypes<T[U]>[0],
  retFormatter: (arg0: PromiseReturnType<T[U]>, ...args: any[]) => V,
) {
  return async (client: T, ...args: any[]): Promise<V> => retFormatter(
    (await (client[methodName] as T[U] extends Function ? T[U] : any)(argMapper(...args))) as PromiseReturnType<T[U]>,
    ...args
  );
}

export function crudBuilder2<T, U extends keyof T>(
  methodName: U,
  argMapper: (...args: any[]) => ArgumentTypes<T[U]>[0],
) {
  return async (client: T, ...args: any[]): Promise<PromiseReturnType<T[U]>> => await (client[methodName] as any)(argMapper(...args));
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
