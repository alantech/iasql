import { Context, Crud2, Mapper2, Module2, } from '../../interfaces'
import * as metadata from './module.json'
import {
  AWS,
  createFunction,
  deleteFunction,
  getFunction,
  getFunctions,
} from './aws'
import { LambdaFunction } from './entity'
import isEqual from 'lodash.isequal'
import pick from 'lodash.pick'
import { Architecture, CreateFunctionCommandInput, GetFunctionResponse, PackageType, Runtime } from '@aws-sdk/client-lambda'
import { AwsIamModule } from '../aws_iam'

const base64ToUint8Array = (base64: string) => {
  const buf = Buffer.from(base64, 'base64');
  const bytes = new Uint8Array(buf);
  return bytes;
}

const lambdaFunctionMapper = async (fn: GetFunctionResponse, ctx: Context) => {
  const out = new LambdaFunction();
  out.architecture = fn.Configuration?.Architectures?.pop() as Architecture;
  out.description = fn.Configuration?.Description;
  out.environment = fn.Configuration?.Environment?.Variables;
  out.handler = fn.Configuration?.Handler;
  out.memorySize = fn.Configuration?.MemorySize;
  out.name = fn.Configuration?.FunctionName ?? 'not possible?';
  out.packageType = fn.Configuration?.PackageType as PackageType;
  try {
    const roleName = AwsIamModule.utils.roleNameFromArn(fn.Configuration?.Role);
    out.role = await AwsIamModule.mappers.role.db.read(ctx, roleName) ??
      await AwsIamModule.mappers.role.cloud.read(ctx, roleName);
    if (!out.role) return undefined;
  } catch (_e: any) {
    // TODO: look for role not found error Code
    return undefined;
  }
  out.runtime = fn.Configuration?.Runtime as Runtime;
  out.tags = fn.Tags;
  out.version = fn.Configuration?.Version;
  return out;
}

export const AwsLambdaModule: Module2 = new Module2({
  ...metadata,
  mappers: {
    lambdaFunction: new Mapper2<LambdaFunction>({
      entity: LambdaFunction,
      equals: (a: LambdaFunction, b: LambdaFunction) => {
        // Handle properly code property
        return true;
        const propertiesA = Object.getOwnPropertyNames(a).sort();
        const propertiesB = Object.getOwnPropertyNames(b).sort();
        if (propertiesA.length !== propertiesB.length) return false;
        return isEqual(
          pick(a, propertiesA),
          pick(b, propertiesB),
        );
      },
      source: 'db',
      cloud: new Crud2({
        create: async (es: LambdaFunction[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const out = [];
          for (const e of es) {
            const input: CreateFunctionCommandInput = {
              FunctionName: e.name,
              Description: e.description,
              Code: {
                ZipFile: base64ToUint8Array(e.zipB64 ?? ''),
              },
              Role: e.role.arn,
              Tags: e.tags,
              Runtime: e.runtime,
              Handler: e.handler,
              PackageType: e.packageType,
              Architectures: e.architecture ? [e.architecture]: [],
              MemorySize: e.memorySize,
              Environment: e.environment ? {
                Variables: e.environment,
              } : undefined,
            };
            const newFunction = await createFunction(client.lambdaClient, input);
            if (!newFunction?.FunctionArn) { // then who?
              throw new Error('should not be possible');
            }
            if (newFunction.FunctionArn && e.tags) {
              await addFunctionTags(client.lambdaClient, newFunction.FunctionArn, e.tags);
            }
            const newEntity = await AwsLambdaModule.mappers.lambdaFunction.cloud.read(ctx, newFunction.FunctionName);
            await AwsLambdaModule.mappers.lambdaFunction.db.update(newEntity, ctx);
            out.push(newEntity);
          }
          return out;
        },
        read: async (ctx: Context, id?: string) => {
          const client = await ctx.getAwsClient() as AWS;
          if (id) {
            const rawFn = await getFunction(client.lambdaClient, id);
            return rawFn ? await lambdaFunctionMapper(rawFn, ctx) : undefined;
          } else {
            const rawFns = (await getFunctions(client.lambdaClient)) ?? [];
            const out = [];
            for (const rawFn of rawFns) {
              const fnMapped = await lambdaFunctionMapper(rawFn, ctx);
              if (fnMapped) out.push(fnMapped);
            }
            return out;
          }
        },
        updateOrReplace: (_a: LambdaFunction, _b: LambdaFunction) => 'replace',
        update: async (es: LambdaFunction[], ctx: Context) => {
          // TODO: implement, how versions will work?
        },
        delete: async (es: LambdaFunction[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          for (const e of es) {
            await deleteFunction(client.lambdaClient, e.name);
          }
        },
      }),
    }),
  },
}, __dirname);