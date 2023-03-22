import {
  CreateDBParameterGroupCommandInput,
  DBParameterGroup,
  paginateDescribeDBParameterGroups,
  paginateDescribeDBParameters,
  Parameter,
  RDS as AWSRDS,
} from '@aws-sdk/client-rds';

import { AwsRdsModule } from '..';
import { objectsAreSame } from '../../../services/aws-diff';
import { AWS, crudBuilder, crudBuilderFormat, mapLin, paginateBuilder } from '../../../services/aws_macros';
import { Context, Crud, MapperBase } from '../../interfaces';
import { ParameterGroup, ParameterGroupFamily } from '../entity';

interface DBParameterGroupWParameters extends DBParameterGroup {
  Parameters: Parameter[];
}

export class ParameterGroupMapper extends MapperBase<ParameterGroup> {
  module: AwsRdsModule;
  entity = ParameterGroup;
  equals = (a: ParameterGroup, b: ParameterGroup) =>
    Object.is(a.arn, b.arn) &&
    Object.is(a.family, b.family) &&
    Object.is(a.description, b.description) &&
    !this.getParametersNotEqual(a.parameters, b.parameters).length &&
    Object.is(a.region, b.region);

  parameterGroupMapper(pg: DBParameterGroupWParameters, region: string) {
    if (/aurora/.test(pg?.DBParameterGroupFamily ?? 'aurora')) return undefined;
    const out = new ParameterGroup();
    out.arn = pg?.DBParameterGroupArn;
    out.description = pg?.Description ?? '';
    out.family = (pg.DBParameterGroupFamily as ParameterGroupFamily) ?? '';
    out.name = pg.DBParameterGroupName ?? '';
    out.parameters = pg.Parameters;
    out.region = region;
    return out;
  }
  getParametersNotEqual(a: Parameter[] | undefined, b: Parameter[] | undefined): Parameter[] {
    if (!a && !b) return [];
    if (!a || !b) return [{} as Parameter];
    const parameters: Parameter[] = [];
    a?.forEach(ap => {
      const bParam = b?.find(bp => Object.is(ap.ParameterName, bp.ParameterName));
      if (!bParam || !objectsAreSame(ap, bParam)) {
        parameters.push(ap);
      }
    });
    return parameters;
  }
  createDBParameterGroup = crudBuilderFormat<AWSRDS, 'createDBParameterGroup', DBParameterGroup | undefined>(
    'createDBParameterGroup',
    input => input,
    res => res?.DBParameterGroup,
  );
  getSimpleDBParameterGroup = crudBuilderFormat<
    AWSRDS,
    'describeDBParameterGroups',
    DBParameterGroup | undefined
  >(
    'describeDBParameterGroups',
    DBParameterGroupName => ({ DBParameterGroupName }),
    res => (res?.DBParameterGroups ?? []).pop(),
  );
  getDBParameterGroupParameters = paginateBuilder<AWSRDS>(
    paginateDescribeDBParameters,
    'Parameters',
    undefined,
    undefined,
    DBParameterGroupName => ({ DBParameterGroupName }),
  );
  getDBParameterGroup = async (client: AWSRDS, DBParameterGroupName: string) => {
    const simpleParameterGroup = await this.getSimpleDBParameterGroup(client, DBParameterGroupName);
    const Parameters = await this.getDBParameterGroupParameters(client, DBParameterGroupName);
    return { ...simpleParameterGroup, Parameters };
  };
  getSimpleDBParameterGroups = paginateBuilder<AWSRDS>(
    paginateDescribeDBParameterGroups,
    'DBParameterGroups',
  );
  getDBParameterGroups = (client: AWSRDS) =>
    mapLin(this.getSimpleDBParameterGroups(client), async (simpleParameterGroup: DBParameterGroup) => {
      const Parameters = await this.getDBParameterGroupParameters(
        client,
        simpleParameterGroup.DBParameterGroupName ?? '',
      );
      return { ...simpleParameterGroup, Parameters };
    });
  modifyParameter = crudBuilder<AWSRDS, 'modifyDBParameterGroup'>(
    'modifyDBParameterGroup',
    (DBParameterGroupName, parameter) => ({ DBParameterGroupName, Parameters: [parameter] }),
  );
  deleteDBParameterGroup = crudBuilder<AWSRDS, 'deleteDBParameterGroup'>(
    'deleteDBParameterGroup',
    DBParameterGroupName => ({ DBParameterGroupName }),
  );

  cloud = new Crud({
    create: async (es: ParameterGroup[], ctx: Context) => {
      const out = [];
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        const parameterGroupInput: CreateDBParameterGroupCommandInput = {
          DBParameterGroupName: e.name,
          DBParameterGroupFamily: e.family,
          Description: e.description,
        };
        const result = await this.createDBParameterGroup(client.rdsClient, parameterGroupInput);
        // Re-get the inserted record to get all of the relevant records we care about
        const newObject = await this.getDBParameterGroup(
          client.rdsClient,
          result?.DBParameterGroupName ?? '',
        );
        // We map this into the same kind of entity as `obj`
        const newEntity = this.parameterGroupMapper(newObject, e.region);
        if (!newEntity) continue;
        newEntity.id = e.id;
        // Save the record back into the database to get the new fields updated
        await this.module.parameterGroup.db.update(newEntity, ctx);
        out.push(newEntity);
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];
      if (id) {
        const { name, region } = this.idFields(id);
        const client = (await ctx.getAwsClient(region)) as AWS;
        const parameterGroup = await this.getDBParameterGroup(client.rdsClient, name);
        if (!parameterGroup) return;
        return this.parameterGroupMapper(parameterGroup, region);
      } else {
        const out: ParameterGroup[] = [];
        await Promise.all(
          enabledRegions.map(async region => {
            const client = (await ctx.getAwsClient(region)) as AWS;
            const parameterGroups = await this.getDBParameterGroups(client.rdsClient);
            for (const pg of parameterGroups) {
              const e = this.parameterGroupMapper(pg, region);
              if (!e) continue;
              out.push(e);
            }
          }),
        );
        return out;
      }
    },
    update: async (es: ParameterGroup[], ctx: Context) => {
      const out = [];
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        const cloudRecord = ctx?.memo?.cloud?.ParameterGroup?.[this.entityId(e)];
        // Always use the cloud ARN, there's no way for the user to actually be able to figure it out
        e.arn = cloudRecord.arn;
        // If that was the only difference, just re-save the updated record and continue
        if (this.equals(e, cloudRecord)) {
          await this.module.parameterGroup.db.update(e, ctx);
          out.push(e);
          continue;
        }
        let updatedRecord = { ...cloudRecord };
        const parametersNotEqual = this.getParametersNotEqual(e.parameters, cloudRecord.parameters);
        let anyUpdate = false;
        for (const p of parametersNotEqual ?? []) {
          if (p.IsModifiable) {
            const parameterInput = {
              ParameterName: p.ParameterName,
              ParameterValue: p.ParameterValue,
              ApplyMethod: p.ApplyMethod,
            };
            await this.modifyParameter(client.rdsClient, e.name, parameterInput);
            anyUpdate = true;
          }
        }
        if (anyUpdate) {
          // Delete record from memo since we want a fresh read from cloud
          delete ctx?.memo?.cloud?.ParameterGroup?.[this.entityId(e)];
          updatedRecord = await this.module.parameterGroup.cloud.read(ctx, this.entityId(e));
        }
        updatedRecord.id = e.id;
        await this.module.parameterGroup.db.update(updatedRecord, ctx);
        out.push(updatedRecord);
      }
      return out;
    },
    delete: async (es: ParameterGroup[], ctx: Context) => {
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        // Default parameter groups cannot be deleted
        if (e.name.startsWith('default.')) {
          await this.module.parameterGroup.db.create(e, ctx);
        } else {
          await this.deleteDBParameterGroup(client.rdsClient, e.name);
        }
      }
    },
  });

  constructor(module: AwsRdsModule) {
    super();
    this.module = module;
    super.init();
  }
}
