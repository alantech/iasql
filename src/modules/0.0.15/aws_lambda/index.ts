import {
  CreateFunctionCommandInput,
  GetFunctionResponse,
  UpdateFunctionCodeCommandInput,
  UpdateFunctionConfigurationCommandInput,
} from '@aws-sdk/client-lambda';
import isEqual from 'lodash.isequal';

import * as metadata from './module.json';
import { Context, Crud2, Mapper2, Module2 } from '../../interfaces';
import {
  addFunctionTags,
  AWS,
  createFunction,
  deleteFunction,
  getFunction,
  getFunctions,
  removeFunctionTags,
  updateFunctionCode,
  updateFunctionConfiguration,
  waitUntilFunctionActive,
  waitUntilFunctionUpdated,
} from './aws';
import { Architecture, LambdaFunction, PackageType, Runtime } from './entity';
import { AwsIamModule } from '../aws_iam';

const base64ToUint8Array = (base64: string) => {
  const buf = Buffer.from(base64, 'base64');
  const bytes = new Uint8Array(buf);
  return bytes;
};

const lambdaFunctionMapper = async (fn: GetFunctionResponse, ctx: Context) => {
  const out = new LambdaFunction();
  out.architecture = (fn.Configuration?.Architectures?.pop() as Architecture) ?? Architecture.x86_64;
  out.description = fn.Configuration?.Description;
  out.environment = fn.Configuration?.Environment?.Variables;
  out.handler = fn.Configuration?.Handler;
  out.memorySize = fn.Configuration?.MemorySize;
  out.name = fn.Configuration?.FunctionName ?? 'not possible?';
  // TODO: once Image package type is avaiable remove this filter
  if (fn.Configuration?.PackageType !== PackageType.Zip) return undefined;
  out.packageType = fn.Configuration?.PackageType as PackageType;
  try {
    const roleName = AwsIamModule.utils.roleNameFromArn(fn.Configuration?.Role);
    out.role =
      (await AwsIamModule.mappers.role.db.read(ctx, roleName)) ??
      (await AwsIamModule.mappers.role.cloud.read(ctx, roleName));
    if (!out.role) return undefined;
  } catch (e: any) {
    // Error code picked from https://docs.aws.amazon.com/en_en/IAM/latest/APIReference/API_GetRole.html
    if (e.Code === 'NoSuchEntity') return undefined;
  }
  out.runtime = fn.Configuration?.Runtime as Runtime;
  out.tags = fn.Tags;
  out.version = fn.Configuration?.Version;
  out.arn = fn.Configuration?.FunctionArn;
  return out;
};

const updateableFunctionFieldsEq = (a: LambdaFunction, b: LambdaFunction) => {
  return (
    Object.is(a.role.roleName, b.role.roleName) &&
    Object.is(a.handler, b.handler) &&
    Object.is(a.memorySize, b.memorySize) &&
    Object.is(a.description, b.description) &&
    isEqual(a.environment, b.environment) &&
    Object.is(a.runtime, b.runtime)
  );
};

const updateableTagsEq = (a: LambdaFunction, b: LambdaFunction) => {
  return isEqual(a.tags, b.tags);
};

const restorableFunctionFieldsEq = (a: LambdaFunction, b: LambdaFunction) => {
  return (
    Object.is(a.arn, b.arn) &&
    Object.is(a.packageType, b.packageType) &&
    Object.is(a.architecture, b.architecture) &&
    Object.is(a.version, b.version)
  );
};

const updateableCodeFieldsEq = (a: LambdaFunction, b: LambdaFunction) => {
  return Object.is(a.zipB64, b.zipB64);
};

export const AwsLambdaModule: Module2 = new Module2(
  {
    ...metadata,
    mappers: {
      lambdaFunction: new Mapper2<LambdaFunction>({
        entity: LambdaFunction,
        equals: (a: LambdaFunction, b: LambdaFunction) =>
          updateableFunctionFieldsEq(a, b) &&
          updateableTagsEq(a, b) &&
          restorableFunctionFieldsEq(a, b) &&
          updateableCodeFieldsEq(a, b),
        source: 'db',
        cloud: new Crud2({
          create: async (es: LambdaFunction[], ctx: Context) => {
            const client = (await ctx.getAwsClient()) as AWS;
            const out = [];
            for (const e of es) {
              // TODO: handle properly once more lambda sources are added (ecr, s3)
              if (!e.zipB64) throw new Error('Missing base64 encoded zip file');
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
                Architectures: e.architecture ? [e.architecture] : [],
                MemorySize: e.memorySize,
                Environment: e.environment
                  ? {
                      Variables: e.environment,
                    }
                  : undefined,
              };
              const newFunction = await createFunction(client.lambdaClient, input);
              if (!newFunction?.FunctionArn) {
                // then who?
                throw new Error('should not be possible');
              }
              await waitUntilFunctionActive(client.lambdaClient, newFunction?.FunctionName ?? '');
              if (newFunction.FunctionArn && e.tags) {
                await addFunctionTags(client.lambdaClient, newFunction.FunctionArn, e.tags);
              }
              // Do not use cloud.read method to avoid cache
              const rawFn = await getFunction(client.lambdaClient, newFunction.FunctionName);
              if (!rawFn) throw new Error('Newly created function could not be found.'); // Should be impossible
              const newEntity = await lambdaFunctionMapper(rawFn, ctx);
              if (newEntity) {
                // Set zipB64 as null to avoid infinite loop trying to update it.
                // Reminder: zipB64 need to be null since when we read Lambda functions from AWS this property is not retrieved
                (newEntity as any).zipB64 = null;
                await AwsLambdaModule.mappers.lambdaFunction.db.update(newEntity, ctx);
                out.push(newEntity);
              }
            }
            return out;
          },
          read: async (ctx: Context, id?: string) => {
            const client = (await ctx.getAwsClient()) as AWS;
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
          update: async (es: LambdaFunction[], ctx: Context) => {
            const client = (await ctx.getAwsClient()) as AWS;
            const out = [];
            for (const e of es) {
              const cloudRecord = ctx?.memo?.cloud?.LambdaFunction?.[e.name ?? ''];
              if (!updateableFunctionFieldsEq(cloudRecord, e)) {
                // Update function configuration
                const input: UpdateFunctionConfigurationCommandInput = {
                  FunctionName: e.name,
                  Role: e.role.arn,
                  Handler: e.handler,
                  Description: e.description,
                  MemorySize: e.memorySize,
                  Environment: {
                    Variables: e.environment,
                  },
                  Runtime: e.runtime,
                };
                await updateFunctionConfiguration(client.lambdaClient, input);
                await waitUntilFunctionUpdated(client.lambdaClient, e.name);
              }
              if (!updateableCodeFieldsEq(cloudRecord, e)) {
                // Update function code
                const input: UpdateFunctionCodeCommandInput = {
                  FunctionName: e.name,
                };
                if (e.architecture) input.Architectures = [e.architecture];
                if (e.zipB64) input.ZipFile = base64ToUint8Array(e.zipB64);
                await updateFunctionCode(client.lambdaClient, input);
                await waitUntilFunctionUpdated(client.lambdaClient, e.name);
              }
              if (!updateableTagsEq(cloudRecord, e)) {
                // Update tags
                const tagKeys = Object.keys(cloudRecord.tags ?? {});
                if (tagKeys && tagKeys.length) await removeFunctionTags(client.lambdaClient, e.arn, tagKeys);
                if (e.tags && Object.keys(e.tags).length) await addFunctionTags(client.lambdaClient, e.arn, e.tags);
              }
              const rawUpdatedFunction = await getFunction(client.lambdaClient, e.name);
              if (rawUpdatedFunction) {
                const updatedFunction: any = await lambdaFunctionMapper(rawUpdatedFunction, ctx);
                if (updatedFunction) {
                  // Set zipB64 as null to avoid infinite loop trying to update it.
                  // Reminder: zipB64 need to be null since when we read Lambda functions from AWS this property is not retrieved
                  updatedFunction.zipB64 = null;
                  await AwsLambdaModule.mappers.lambdaFunction.db.update(updatedFunction, ctx);
                  out.push(updatedFunction);
                }
              }
            }
            return out;
          },
          delete: async (es: LambdaFunction[], ctx: Context) => {
            const client = (await ctx.getAwsClient()) as AWS;
            for (const e of es) {
              await deleteFunction(client.lambdaClient, e.name);
            }
          },
        }),
      }),
    },
  },
  __dirname
);
