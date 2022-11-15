import isEqual from 'lodash.isequal';

import { EC2, NetworkInterface } from '@aws-sdk/client-ec2';
import {
  CreateFunctionCommandInput,
  GetFunctionResponse,
  UpdateFunctionCodeCommandInput,
  UpdateFunctionConfigurationCommandInput,
} from '@aws-sdk/client-lambda';

import { AwsLambdaModule } from '..';
import { throwError } from '../../../../config/config';
import { crudBuilderFormat } from '../../../../services/aws_macros';
import { Context, Crud2, MapperBase } from '../../../interfaces';
import { awsIamModule } from '../../aws_iam';
import { awsSecurityGroupModule } from '../../aws_security_group';
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
} from '../aws';
import { Architecture, LambdaFunction, PackageType, Runtime } from '../entity';

export class LambdaFunctionMapper extends MapperBase<LambdaFunction> {
  module: AwsLambdaModule;
  entity = LambdaFunction;
  equals = (a: LambdaFunction, b: LambdaFunction) =>
    this.updateableFunctionFieldsEq(a, b) &&
    this.updateableTagsEq(a, b) &&
    this.restorableFunctionFieldsEq(a, b) &&
    this.updateableCodeFieldsEq(a, b) &&
    this.updateableConfigFieldsEq(a, b);

  updateableFunctionFieldsEq(a: LambdaFunction, b: LambdaFunction) {
    return (
      Object.is(a.role?.roleName, b.role?.roleName) &&
      Object.is(a.handler, b.handler) &&
      Object.is(a.memorySize, b.memorySize) &&
      Object.is(a.description, b.description) &&
      isEqual(a.environment, b.environment) &&
      Object.is(a.runtime, b.runtime)
    );
  }

  base64ToUint8Array(base64: string) {
    const buf = Buffer.from(base64, 'base64');
    const bytes = new Uint8Array(buf);
    return bytes;
  }

  async lambdaFunctionMapper(fn: GetFunctionResponse, ctx: Context, region: string) {
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
      const roleName = awsIamModule.role.roleNameFromArn(
        fn.Configuration?.Role ?? throwError('No rolename defined'),
        ctx,
      );
      out.role =
        (await awsIamModule.role.db.read(ctx, roleName)) ??
        (await awsIamModule.role.cloud.read(ctx, roleName));
      if (!out.role) return undefined;
    } catch (e: any) {
      // Error code picked from https://docs.aws.amazon.com/en_en/IAM/latest/APIReference/API_GetRole.html
      if (e.Code === 'NoSuchEntity') return undefined;
    }
    out.runtime = fn.Configuration?.Runtime as Runtime;
    out.tags = fn.Tags;
    out.version = fn.Configuration?.Version;
    out.arn = fn.Configuration?.FunctionArn;
    out.region = region;
    out.subnets = fn.Configuration.VpcConfig?.SubnetIds;

    const securityGroups = [];
    const cloudSecurityGroups = fn.Configuration.VpcConfig?.SecurityGroupIds ?? [];
    for (const sg of cloudSecurityGroups) {
      securityGroups.push(
        (await awsSecurityGroupModule.securityGroup.db.read(
          ctx,
          awsSecurityGroupModule.securityGroup.generateId({ groupId: sg, region }),
        )) ??
          (await awsSecurityGroupModule.securityGroup.cloud.read(
            ctx,
            awsSecurityGroupModule.securityGroup.generateId({ groupId: sg, region }),
          )),
      );
    }
    if (securityGroups.filter(sg => !!sg).length !== cloudSecurityGroups.length)
      throw new Error('Security groups need to be loaded first');
    out.securityGroups = securityGroups;
    return out;
  }

  updateableTagsEq(a: LambdaFunction, b: LambdaFunction) {
    return isEqual(a.tags, b.tags);
  }

  updateableConfigFieldsEq(a: LambdaFunction, b: LambdaFunction) {
    const result =
      Object.is(a.securityGroups?.length, b.securityGroups?.length) &&
      (a.securityGroups?.every(asg => !!b.securityGroups?.find(bsg => Object.is(asg.groupId, bsg.groupId))) ??
        false) &&
      Object.is(a.subnets?.length, b.subnets?.length) &&
      (a.subnets?.every(asn => !!b.subnets?.find(bsn => Object.is(asn, bsn))) ?? false);
    return result;
  }

  restorableFunctionFieldsEq(a: LambdaFunction, b: LambdaFunction) {
    return (
      Object.is(a.arn, b.arn) &&
      Object.is(a.packageType, b.packageType) &&
      Object.is(a.architecture, b.architecture) &&
      Object.is(a.version, b.version)
    );
  }

  updateableCodeFieldsEq(a: LambdaFunction, b: LambdaFunction) {
    return Object.is(a.zipB64, b.zipB64);
  }

  getNetworkInterfaces = crudBuilderFormat<EC2, 'describeNetworkInterfaces', NetworkInterface[] | undefined>(
    'describeNetworkInterfaces',
    subnetId => ({
      Filters: [
        {
          Name: 'subnet-id',
          Values: [subnetId],
        },
        {
          Name: 'interface-type',
          Values: ['lambda'],
        },
      ],
    }),
    res => res?.NetworkInterfaces,
  );

  async deleteNetworkInterface(client: EC2, subnet: string, name: string) {
    // first get all interfaces for that subnet
    const interfaces = await this.getNetworkInterfaces(client, subnet);

    if (interfaces) {
      for (const i of interfaces) {
        // iterate and check if description matches lambda function name
        if (i.Description && i.Description.includes(name) && i.NetworkInterfaceId)
          await client.deleteNetworkInterface({ NetworkInterfaceId: i.NetworkInterfaceId });
      }
    }
  }

  cloud = new Crud2({
    create: async (es: LambdaFunction[], ctx: Context) => {
      const out = [];
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;

        // if role does not exist in the cloud, continue, should be created later
        const role = await awsIamModule.role.cloud.read(ctx, e.role.roleName);
        if (!role) continue;

        // TODO: handle properly once more lambda sources are added (ecr, s3)
        if (!e.zipB64) throw new Error('Missing base64 encoded zip file');

        const input: CreateFunctionCommandInput = {
          FunctionName: e.name,
          Description: e.description,
          Code: {
            ZipFile: this.base64ToUint8Array(e.zipB64 ?? ''),
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

          VpcConfig: {
            SubnetIds: e.subnets ?? [],
            SecurityGroupIds: e.securityGroups.map(s => s.groupId ?? '') ?? [],
          },
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
        const newEntity = await this.lambdaFunctionMapper(rawFn, ctx, e.region);

        if (newEntity) {
          newEntity.id = e.id;
          // Set zipB64 as null to avoid infinite loop trying to update it.
          // Reminder: zipB64 need to be null since when we read Lambda functions from AWS this property is not retrieved
          (newEntity as any).zipB64 = null;
          await this.module.lambdaFunction.db.update(newEntity, ctx);
          out.push(newEntity);
        }
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];
      if (!!id) {
        const { region, name } = this.idFields(id);
        if (enabledRegions.includes(region)) {
          const client = (await ctx.getAwsClient(region)) as AWS;
          const rawFn = await getFunction(client.lambdaClient, name);
          return rawFn ? await this.lambdaFunctionMapper(rawFn, ctx, region) : undefined;
        }
      } else {
        const out: LambdaFunction[] = [];
        await Promise.all(
          enabledRegions.map(async region => {
            const client = (await ctx.getAwsClient(region)) as AWS;
            const rawFns = (await getFunctions(client.lambdaClient)) ?? [];
            for (const rawFn of rawFns) {
              const fnMapped = await this.lambdaFunctionMapper(rawFn, ctx, region);
              if (fnMapped) out.push(fnMapped);
            }
          }),
        );
        return out;
      }
    },
    update: async (es: LambdaFunction[], ctx: Context) => {
      const out = [];
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        const cloudRecord = ctx?.memo?.cloud?.LambdaFunction?.[this.entityId(e)];
        if (
          !this.updateableFunctionFieldsEq(cloudRecord, e) ||
          !this.updateableConfigFieldsEq(cloudRecord, e)
        ) {
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
            VpcConfig: {
              SubnetIds: e.subnets ?? [],
              SecurityGroupIds: e.securityGroups.map(s => s.groupId ?? '') ?? [],
            },
          };
          await updateFunctionConfiguration(client.lambdaClient, input);
          await waitUntilFunctionUpdated(client.lambdaClient, e.name);

          // check the network interfaces that are not applying and remove those
          const remaining = (cloudRecord.subnets ?? []).filter((x: string) => !(e.subnets ?? []).includes(x));
          for (const s of remaining) {
            await this.deleteNetworkInterface(client.ec2client, s, e.name);
          }
        }

        if (!this.updateableCodeFieldsEq(cloudRecord, e)) {
          // Update function code
          const input: UpdateFunctionCodeCommandInput = {
            FunctionName: e.name,
          };
          if (e.architecture) input.Architectures = [e.architecture];
          if (e.zipB64) input.ZipFile = this.base64ToUint8Array(e.zipB64);
          await updateFunctionCode(client.lambdaClient, input);
          await waitUntilFunctionUpdated(client.lambdaClient, e.name);
        }
        if (!this.updateableTagsEq(cloudRecord, e)) {
          // Update tags
          const tagKeys = Object.keys(cloudRecord.tags ?? {});
          if (tagKeys && tagKeys.length) await removeFunctionTags(client.lambdaClient, e.arn, tagKeys);
          if (e.tags && Object.keys(e.tags).length) await addFunctionTags(client.lambdaClient, e.arn, e.tags);
        }
        const rawUpdatedFunction = await getFunction(client.lambdaClient, e.name);
        if (rawUpdatedFunction) {
          const updatedFunction: any = await this.lambdaFunctionMapper(rawUpdatedFunction, ctx, e.region);
          if (updatedFunction) {
            updatedFunction.id = e.id;
            // Set zipB64 as null to avoid infinite loop trying to update it.
            // Reminder: zipB64 need to be null since when we read Lambda functions from AWS this property is not retrieved
            updatedFunction.zipB64 = null;
            await this.module.lambdaFunction.db.update(updatedFunction, ctx);
            out.push(updatedFunction);
          }
        }
      }
      return out;
    },
    delete: async (es: LambdaFunction[], ctx: Context) => {
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        const region = e.region;
        await deleteFunction(client.lambdaClient, e.name);

        // check all associated subnets and get the vpc id, to get associated endpoint interfaces
        if (e.subnets) {
          for (const s of e.subnets) {
            await this.deleteNetworkInterface(client.ec2client, s, e.name);
          }
        }
      }
    },
  });

  constructor(module: AwsLambdaModule) {
    super();
    this.module = module;
    super.init();
  }
}
