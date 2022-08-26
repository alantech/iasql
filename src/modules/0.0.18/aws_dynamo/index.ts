import isequal from 'lodash.isequal';
import pick from 'lodash.pick';

import {
  CreateTableCommandInput,
  DynamoDB,
  TableDescription,
  UpdateTableCommandInput,
  paginateListTables,
  waitUntilTableExists,
  waitUntilTableNotExists,
} from '@aws-sdk/client-dynamodb';
import { WaiterOptions } from '@aws-sdk/util-waiter';

import { throwError } from '../../../config/config';
import { AWS, crudBuilder2, paginateBuilder } from '../../../services/aws_macros';
import { Context, Crud2, MapperBase, ModuleBase } from '../../interfaces';
import { DynamoTable, TableClass } from './entity';

class DynamoTableMapper extends MapperBase<DynamoTable> {
  module: AwsDynamoModule;
  entity = DynamoTable;
  equals = (a: DynamoTable, b: DynamoTable) =>
    isequal(
      pick(a, ['tableName', 'tableClass', 'throughput', 'tableId', 'primaryKey', 'createdAt']),
      pick(b, ['tableName', 'tableClass', 'throughput', 'tableId', 'primaryKey', 'createdAt'])
    );

  getTable = crudBuilder2<DynamoDB, 'describeTable'>('describeTable', TableName => ({ TableName }));
  listTables = paginateBuilder<DynamoDB>(paginateListTables, 'TableNames');
  createTable = crudBuilder2<DynamoDB, 'createTable'>('createTable', input => input);
  updateTable = crudBuilder2<DynamoDB, 'updateTable'>('updateTable', input => input);
  deleteTable = crudBuilder2<DynamoDB, 'deleteTable'>('deleteTable', TableName => ({ TableName }));

  dynamoMapper(dynamo: TableDescription) {
    const out = new DynamoTable();
    out.tableName = dynamo.TableName ?? throwError('Did not get a table name from AWS');
    out.tableClass = (dynamo.TableClassSummary?.TableClass as TableClass) ?? 'STANDARD';
    out.throughput =
      dynamo.BillingModeSummary?.BillingMode === 'PAY_PER_REQUEST'
        ? 'PAY_PER_REQUEST'
        : {
            ReadCapacityUnits: dynamo.ProvisionedThroughput?.ReadCapacityUnits ?? 0,
            WriteCapacityUnits: dynamo.ProvisionedThroughput?.WriteCapacityUnits ?? 0,
          };
    out.tableId = dynamo.TableId;
    const types = Object.fromEntries(
      dynamo.AttributeDefinitions?.map(ad => [ad.AttributeName, ad.AttributeType]) ?? []
    );
    out.primaryKey = Object.fromEntries(
      dynamo.KeySchema?.sort((a, _b) => (a.KeyType === 'HASH' ? -1 : 1))
        .filter(ks => !!ks.AttributeName)
        .map(ks => [ks.AttributeName, types[ks.AttributeName as string]]) ?? []
    );
    out.createdAt = dynamo.CreationDateTime;
    return out;
  }

  cloud = new Crud2<DynamoTable>({
    create: async (es: DynamoTable[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      const out = [];
      for (const e of es) {
        const req: CreateTableCommandInput = {
          TableName: e.tableName,
          TableClass: e.tableClass,
          BillingMode: e.throughput === 'PAY_PER_REQUEST' ? 'PAY_PER_REQUEST' : 'PROVISIONED',
          AttributeDefinitions: Object.entries(e.primaryKey).map(([AttributeName, AttributeType]) => ({
            AttributeName,
            AttributeType,
          })),
          KeySchema: Object.entries(e.primaryKey).map(([AttributeName, _], i) => ({
            AttributeName,
            // Must always include hash, optionally range, so the first key is hash. Relying
            // on Javascript's behavior that object key order is static, which is codified in
            // the standard, but if they ever change that, this will require writing our own
            // JSON parser to restore
            KeyType: i === 0 ? 'HASH' : 'RANGE',
          })),
        };
        if (e.throughput !== 'PAY_PER_REQUEST') req.ProvisionedThroughput = e.throughput;
        const res = await this.createTable(client.dynamoClient, req);
        if (!res?.TableDescription) continue; // Failed to create this table, maybe next loop?
        await waitUntilTableExists(
          {
            client: client.dynamoClient,
            // all in seconds
            maxWaitTime: 300,
            minDelay: 1,
            maxDelay: 4,
          } as WaiterOptions<DynamoDB>,
          { TableName: e.tableName }
        );
        const newTable = this.dynamoMapper(res.TableDescription);
        // We attach the original object's ID to this new one, indicating the exact record it is
        // replacing in the database.
        newTable.id = e.id;
        // Save the record back into the database to get the new fields updated
        await this.module.dynamoTable.db.update(newTable, ctx);
        out.push(newTable);
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      const client = (await ctx.getAwsClient()) as AWS;
      if (id) {
        const rawTable = await this.getTable(client.dynamoClient, id);
        if (!rawTable?.Table) return;
        return this.dynamoMapper(rawTable.Table);
      } else {
        const tableNames = await this.listTables(client.dynamoClient);
        const out = [];
        for (const tableName of tableNames) {
          const rawTable = await this.getTable(client.dynamoClient, tableName);
          if (!rawTable?.Table) return;
          out.push(this.dynamoMapper(rawTable.Table));
        }
        return out;
      }
    },
    updateOrReplace: () => 'update',
    update: async (es: DynamoTable[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      const out = [];
      for (const e of es) {
        const req: UpdateTableCommandInput = {
          TableName: e.tableName,
          /* TableClass: e.tableClass, */ // Can only be updated on its own, apparently?
          BillingMode: e.throughput === 'PAY_PER_REQUEST' ? 'PAY_PER_REQUEST' : 'PROVISIONED',
          AttributeDefinitions: Object.entries(e.primaryKey).map(([AttributeName, AttributeType]) => ({
            AttributeName,
            AttributeType,
          })),
          /*KeySchema: e.primaryKey, */ // TODO: A replace mode for an updated keyschema
        };
        if (e.throughput !== 'PAY_PER_REQUEST') req.ProvisionedThroughput = e.throughput;
        const res = await this.updateTable(client.dynamoClient, req);
        if (!res?.TableDescription) continue; // Failed to create this table, maybe next loop?
        await waitUntilTableExists(
          {
            client: client.dynamoClient,
            // all in seconds
            maxWaitTime: 300,
            minDelay: 1,
            maxDelay: 4,
          } as WaiterOptions<DynamoDB>,
          { TableName: e.tableName }
        );
        const newTable = this.dynamoMapper(res.TableDescription);
        // We attach the original object's ID to this new one, indicating the exact record it is
        // replacing in the database.
        newTable.id = e.id;
        // Save the record back into the database to get the new fields updated
        await this.module.dynamoTable.db.update(newTable, ctx);
        out.push(newTable);
      }
      return out;
    },
    delete: async (es: DynamoTable[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      for (const e of es) {
        await this.deleteTable(client.dynamoClient, e.tableName);
        await waitUntilTableNotExists(
          {
            client: client.dynamoClient,
            // all in seconds
            maxWaitTime: 300,
            minDelay: 1,
            maxDelay: 4,
          } as WaiterOptions<DynamoDB>,
          { TableName: e.tableName }
        );
      }
    },
  });

  constructor(module: AwsDynamoModule) {
    super();
    this.module = module;
    super.init();
  }
}

class AwsDynamoModule extends ModuleBase {
  dynamoTable: DynamoTableMapper;

  constructor() {
    super();
    this.dynamoTable = new DynamoTableMapper(this);
    super.init();
  }
}
export const awsDynamoModule = new AwsDynamoModule();
