import { In, } from 'typeorm'

import { AWSCloudControl, } from '../../services/gateways/aws-cc'
import * as allEntities from '../aws_cloudwatch/entity'
import { Context, Crud, Mapper, Module, } from '../interfaces'
import { LogGroup } from '../aws_cloudwatch/entity'
import { awsCloudwatch1638980988627 } from '../aws_cloudwatch/migration/1638980988627-aws_cloudwatch'

const CC_TYPENAME = 'AWS::Logs::LogGroup';

export const AwsCloudwatchModule: Module = new Module({
  name: 'aws_cloudwatch',
  dependencies: ['aws_account'],
  provides: {
    entities: allEntities,
    tables: ['log_group',],
    functions: ['create_cloudwatch_log_group',],
  },
  utils: {
    logGroupMapper: (lg: any, _ctx: Context) => {
      const out = new LogGroup();
      if (!lg?.logGroupName) throw new Error('No log group name defined');
      out.logGroupName = lg.logGroupName;
      out.logGroupArn = lg.arn;
      out.creationTime = lg.creationTime ? new Date(lg.creationTime) : lg.creationTime;
      return out;
    },
  },
  mappers: {
    logGroup: new Mapper<LogGroup>({
      entity: LogGroup,
      entityId: (e: LogGroup) => e?.logGroupName,
      entityPrint: (e: LogGroup) => ({
        id: e?.id?.toString() ?? '',
        logGroupName: e?.logGroupName ?? '',
        logGroupArn: e?.logGroupArn ?? '',
        creationTime: e?.creationTime?.toISOString() ?? '',
      }),
      equals: (_a: LogGroup, _b: LogGroup) => true, // TODO: Fix this
      source: 'db',
      db: new Crud({
        create: (e: LogGroup[], ctx: Context) => ctx.orm.save(LogGroup, e),
        read: (ctx: Context, ids?: string[]) => ctx.orm.find(LogGroup, ids ? {
          where: {
            logGroupName: In(ids),
          },
        } : undefined),
        update: (e: LogGroup[], ctx: Context) => ctx.orm.save(LogGroup, e),
        delete: (e: LogGroup[], ctx: Context) => ctx.orm.remove(LogGroup, e),
      }),
      cloud: new Crud({
        create: async (lg: LogGroup[], ctx: Context) => {
          const client = await ctx.getAwsCloudControlClient() as AWSCloudControl;
          return await Promise.all(lg.map(async (e) => {
            const desiredState = JSON.stringify({
              "LogGroupName": e.logGroupName,
            })
            await client.createResource(CC_TYPENAME, desiredState);
            // Re-get the inserted record to get all of the relevant records we care about
            const newObject = await client.getResource(CC_TYPENAME, e.logGroupName);
            // We map this into the same kind of entity as `obj`
            const newEntity = await AwsCloudwatchModule.utils.logGroupMapper(newObject, ctx);
            // We attach the original object's ID to this new one, indicating the exact record it is
            // replacing in the database.
            newEntity.id = e.id;
            // Save the record back into the database to get the new fields updated
            await AwsCloudwatchModule.mappers.logGroup.db.update(newEntity, ctx);
            return newEntity;
          }));
        },
        read: async (ctx: Context, ids?: string[]) => {
          const client = await ctx.getAwsCloudControlClient() as AWSCloudControl;
          ids = Array.isArray(ids) ? ids : []
          const logGroups = (await Promise.all(ids.map(id => client.getResource(CC_TYPENAME, id)))).flat();
          return await Promise.all(
            logGroups.map((lg: any) => AwsCloudwatchModule.utils.logGroupMapper(lg, ctx))
          );
        },
        update: async (_lg: LogGroup[], _ctx: Context) => { /** TODO */ },
        delete: async (lg: LogGroup[], ctx: Context) => {
          const client = await ctx.getAwsCloudControlClient() as AWSCloudControl;
          await Promise.all(lg.map((e) => client.deleteResource(CC_TYPENAME, e.logGroupName)));
        },
      }),
    }),
  },
  migrations: {
    postinstall: awsCloudwatch1638980988627.prototype.up,
    preremove: awsCloudwatch1638980988627.prototype.down,
  },
});