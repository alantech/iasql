import callsite from 'callsite';
import fs from 'fs';
import _ from 'lodash';
import path from 'path';
import format from 'pg-format';
import { parse } from 'pgsql-parser';
import { ColumnType, getMetadataArgsStorage, QueryRunner } from 'typeorm';
import { snakeCase } from 'typeorm/util/StringUtils';

import config from '../config';
import { throwError } from '../config/config';
import { AWS, crudBuilder2 } from '../services/aws_macros';
import { getCloudId } from '../services/cloud-id';
import { safeParse } from '../services/common';
import logger from '../services/logger';

// The exported interfaces are meant to provide better type checking both at compile time and in the
// editor. They *shouldn't* have to be ever imported directly, only the classes ought to be, but as
// the classes use these interfaces it helps give you hints as you develop a lot better than without
// them.

export type IdFields = { [key: string]: string };

export type Context = { [key: string]: any };

// TODO: use something better than ColumnType for possible postgres colum types
export type RpcOutput = { [key: string]: ColumnType };
export type RpcInput = {
  [key: string]:
    | string
    | { argType: string; default?: string | boolean | null; rawDefault?: boolean; variadic?: true };
};

export type RpcResponseObject<T> = { [Properties in keyof T]: any };

export enum PreTransactionCheck {
  NO_CHECK = 'no-check',
  WAIT_FOR_LOCK = 'wait-for-lock',
  FAIL_IF_NOT_LOCKED = 'fail-if-not-locked',
}

export enum PostTransactionCheck {
  NO_CHECK = 'no-check',
  UNLOCK_IF_SUCCEED = 'unlock-if-succeed',
  UNLOCK_ALWAYS = 'unlock-always',
}

export interface CrudInterface2<E> {
  create: (e: E[], ctx: Context) => Promise<void | E[]>;
  read: (ctx: Context, id?: string) => Promise<E[] | E | void>;
  updateOrReplace?: (prev: E, next: E) => 'update' | 'replace';
  update: (e: E[], ctx: Context) => Promise<void | E[]>;
  delete: (e: E[], ctx: Context) => Promise<void | E[]>;
}

/** @internal */
export class Crud2<E extends {}> {
  module: ModuleInterface;
  createFn: (e: E[], ctx: Context) => Promise<void | E[]>;
  readFn: (ctx: Context, id?: string) => Promise<E[] | E | void>;
  updateFn: (e: E[], ctx: Context) => Promise<void | E[]>;
  updateOrReplaceFn: (prev: E, next: E) => 'update' | 'replace';
  deleteFn: (e: E[], ctx: Context) => Promise<void | E[]>;
  dest?: 'db' | 'cloud';
  entity?: new () => E;
  entityId?: (e: E) => string;
  idFields?: (id: string) => IdFields;

  constructor(def: CrudInterface2<E>) {
    this.createFn = def.create;
    this.readFn = def.read;
    this.updateOrReplaceFn = def.updateOrReplace ?? (() => 'update');
    this.updateFn = def.update;
    this.deleteFn = def.delete;
  }

  memo(entity: void | E | E[], ctx: Context, input?: any | any[]) {
    if (!entity) return;
    const es = Array.isArray(entity) ? entity : [entity];
    const dest = this.dest ?? 'What?';
    const entityName = this.entity?.name ?? 'What?';
    const entityId =
      this.entityId ??
      ((_e: E) => {
        return 'What?';
      });
    es.forEach((e, i) => {
      ctx.memo[dest] = ctx.memo[dest] ?? {};
      ctx.memo[dest][entityName] = ctx.memo[dest][entityName] ?? {};
      if (!ctx.memo[dest][entityName][entityId(e)]) {
        ctx.memo[dest][entityName][entityId(e)] = e;
      } else {
        // Transfer the properties from the entity to the one already memoized so other references
        // to the same entity also get updated, then update the output array
        const realE = ctx.memo[dest][entityName][entityId(e)];
        Object.keys(e).forEach(k => (realE[k] = (e as any)[k]));
        es[i] = realE;
      }
    });
    if (Array.isArray(entity) && (Array.isArray(input) || input === undefined)) {
      return entity;
    } else {
      // To return the possibly-changed entity instead of the original input one
      return es[0];
    }
  }

  unmemo(entity: void | E | E[], ctx: Context) {
    if (!entity) return;
    const es = Array.isArray(entity) ? entity : [entity];
    const dest = this.dest ?? 'What?';
    const entityName = this.entity?.name ?? 'What?';
    const entityId =
      this.entityId ??
      ((_e: E) => {
        return 'What?';
      });
    es.forEach(e => {
      ctx.memo[dest] = ctx.memo[dest] ?? {};
      ctx.memo[dest][entityName] = ctx.memo[dest][entityName] ?? {};
      delete ctx.memo[dest][entityName][entityId(e)];
    });
  }

  async create(e: E | E[], ctx: Context) {
    logger.debug(`Calling ${this.entity?.name ?? ''} ${this.dest} create`);
    const es = Array.isArray(e) ? e : [e];
    // Memoize before and after the actual logic to make sure the unique ID is reserved
    this.memo(e, ctx);
    try {
      return this.memo(await this.createFn(es, ctx), ctx, e);
    } catch (err: any) {
      // Unmemo if it failed
      this.unmemo(e, ctx);
      err.message = `${this.entity?.name} ${this.dest} create error: ${err.message}`;
      throw err;
    }
  }

  async read(ctx: Context, id?: string) {
    logger.debug(`Calling ${this.entity?.name ?? ''} ${this.dest} read ${id}`);
    const entityId =
      this.entityId ??
      ((_e: E) => {
        return 'What?';
      });
    if (id) {
      const dest = this.dest ?? 'What?';
      const entityName = this.entity?.name ?? 'What?';
      // Possibly store an empty entity in the memoization before the call is done to make sure
      // circular loops don't really happen (a later call for the same ID will eject earlier)
      ctx.memo[dest] = ctx.memo[dest] ?? {};
      ctx.memo[dest][entityName] = ctx.memo[dest][entityName] ?? {};
      if (!ctx.memo[dest][entityName][id]) {
        logger.debug(`Cache miss for ${this.entity?.name ?? ''} ${this.dest}`);
        ctx.memo[dest][entityName][id] = new (this.entity as new () => E)();
      } else {
        // If object is empty it means it is a placeholder and it is not in the memo yet.
        if (!Object.keys(ctx.memo[dest][entityName][id]).length) {
          logger.debug(`Cache miss for ${this.entity?.name ?? ''} ${this.dest}`);
        } else {
          logger.debug(`Cache hit for ${this.entity?.name ?? ''} ${this.dest}`);
          return ctx.memo[dest][entityName][id];
        }
      }
      // Linter thinks this is shadowing the other one on line 152 because JS hoisting nonsense
      let o;
      try {
        o = await this.readFn(ctx, id);
      } catch (err: any) {
        // Don't memo in this case, remove the registered placeholder and throw
        delete ctx.memo[dest][entityName][id];
        err.message = `${this.entity?.name} ${this.dest} read error: ${err.message}`;
        throw err;
      }
      if (!o || (Array.isArray(o) && o.length === 0)) {
        // Don't memo in this case, just pass it through, also remove the registered placeholder
        delete ctx.memo[dest][entityName][id];
        return undefined;
      } else if (Array.isArray(o) && o.length === 1) {
        return this.memo(o[0], ctx, id);
      } else {
        return this.memo(o, ctx, id);
      }
    }
    logger.debug(`Full cache miss for ${this.entity?.name ?? ''} ${this.dest}`);
    let out;
    try {
      out = await this.readFn(ctx);
    } catch (err: any) {
      err.message = `${this.entity?.name} ${this.dest} read error: ${err.message}`;
      throw err;
    }
    if (!out || (Array.isArray(out) && out.length === 0)) {
      // Don't memo in this case, just pass it through
      return out;
    } else if (Array.isArray(out)) {
      return this.memo(out, ctx, out.map(entityId));
    } else {
      return this.memo(out, ctx, entityId(out));
    }
  }

  async update(e: E | E[], ctx: Context) {
    logger.debug(`Calling ${this.entity?.name ?? ''} ${this.dest} update`);
    const es = Array.isArray(e) ? e : [e];
    try {
      return this.memo(await this.updateFn(es, ctx), ctx, e);
    } catch (err: any) {
      err.message = `${this.entity?.name} ${this.dest} update error: ${err.message}`;
      throw err;
    }
  }

  async delete(e: E | E[], ctx: Context) {
    logger.debug(`Calling ${this.entity?.name ?? ''} ${this.dest} delete`);
    const es = Array.isArray(e) ? e : [e];
    // We clone the entities to be able to unmemo entities which entityId is based on the `id` autogenerated by the db
    const esClone = es.map(e2 => ({ ...e2 }));
    let out;
    try {
      out = await this.deleteFn(es, ctx);
    } catch (err: any) {
      err.message = `${this.entity?.name} ${this.dest} delete error: ${err.message}`;
      throw err;
    }
    this.unmemo(esClone, ctx); // Remove deleted record(s) from the memo
    if (!Array.isArray(e) && Array.isArray(out)) {
      return out[0];
    } else {
      return out;
    }
  }

  updateOrReplace(prev: E, next: E): 'update' | 'replace' {
    return this.updateOrReplaceFn(prev, next);
  }
}

/** @internal */
export interface MapperInterface<E extends {}> {
  entity: new () => E;
  entityId: (e: E) => string;
  idFields: (id: string) => IdFields;
  generateId: (idFields: IdFields) => string;
  equals: (a: E, b: E) => boolean;
  source: 'db' | 'cloud';
  db: Crud2<E>;
  cloud: Crud2<E>;
}

export interface RpcInterface {
  module: ModuleInterface;
  outputTable: RpcOutput;
  preTransactionCheck: PreTransactionCheck;
  postTransactionCheck: PostTransactionCheck;
  call: (
    dbId: string,
    dbUser: string,
    ctx: Context,
    ...args: string[]
  ) => Promise<RpcResponseObject<RpcOutput>[]>;

  getInstallUninstallSql: (key: string) => { beforeUninstallSql: string; afterInstallSql: string };
}

/** @internal */
export class MapperBase<E extends {}> {
  module: ModuleInterface;
  entity: new () => E;
  entityId: (e: E) => string;
  // TODO: add better typing based on cloudColumns if possible
  idFields: (id: string) => IdFields;
  generateId: (idFields: IdFields) => string;
  equals: (a: E, b: E) => boolean;
  source: 'db' | 'cloud';
  db: Crud2<E>;
  cloud: Crud2<E>;

  init() {
    if (!this.module) throw new Error('No module link established for this mapper');
    if (!this.entity) throw new Error('No entity defined for this mapper');
    const cloudColumns = getCloudId(this.entity);
    const ormMetadata = getMetadataArgsStorage();
    // Technically we should have a check for if only one of the two is defined, because the author
    // could create the 'id' string any way they want, and if not properly paired it could break in
    // weird ways, but since all extant versions of 'entityId' join with '|', we're rolling with it
    const primaryColumn =
      ormMetadata.columns
        .filter(c => c.target === this.entity)
        .filter(c => c.options.primary)
        .map(c => c.propertyName)
        .shift() ?? '';
    if (!this.generateId) {
      this.generateId = (fields: IdFields) => {
        if (cloudColumns && !(cloudColumns instanceof Error)) {
          if (
            Object.keys(fields).length !== cloudColumns.length ||
            !Object.keys(fields).every(fk => cloudColumns.includes(fk))
          ) {
            throw new Error(
              `Id generation error. Valid fields to generate id are: ${cloudColumns.join(
                ', ',
              )}. Receiving: ${Object.keys(fields).join(', ')}`,
            );
          }
          const out = cloudColumns.map(col => fields[col]).join('|');
          if (!out) return fields[primaryColumn] + '';
          return out;
        } else {
          if (
            Object.keys(fields).length !== 1 ||
            !Object.keys(fields).every(fk => [primaryColumn].includes(fk))
          ) {
            throw new Error(
              `Id generation error. Valid field to generate id is: ${primaryColumn}. Receiving: ${Object.keys(
                fields,
              ).join(', ')}`,
            );
          }
          return fields[primaryColumn] + '';
        }
      };
    }
    if (!this.entityId || !this.idFields) {
      // Using + '' to coerce to string without worrying if `.toString()` exists, because JS
      this.entityId =
        this.entityId ||
        ((e: E) => {
          if (cloudColumns && !(cloudColumns instanceof Error)) {
            if (cloudColumns.some(col => !(e as any)[col])) return (e as any)[primaryColumn] + '';
            const out = cloudColumns.map(col => (e as any)[col]).join('|');
            if (!out) return (e as any)[primaryColumn] + '';
            return out;
          } else {
            return (e as any)[primaryColumn] + '';
          }
        });
      this.idFields =
        this.idFields ||
        ((id: string) => {
          const fields: IdFields = {};
          const splittedId = id.split('|');
          if (cloudColumns && !(cloudColumns instanceof Error)) {
            cloudColumns.forEach((cc, i) => (fields[cc] = splittedId[i]));
          } else {
            fields[primaryColumn] = splittedId.pop() ?? '';
          }
          return fields;
        });
    }
    if (!this.equals) throw new Error('No entity equals method defined'); // TODO: Make a default
    if (!this.source) this.source = 'db';
    if (this.db) {
      this.db.entity = this.entity;
      this.db.entityId = this.entityId;
      this.db.idFields = this.idFields;
      this.db.dest = 'db';
      this.db.module = this.module;
    } else if (!!cloudColumns && !(cloudColumns instanceof Error)) {
      this.db = new Crud2<E>({
        create: (es: E[], ctx: Context) => ctx.orm.save(this.entity, es),
        update: (es: E[], ctx: Context) => ctx.orm.save(this.entity, es),
        delete: (es: E[], ctx: Context) => ctx.orm.remove(this.entity, es),
        read: async (ctx: Context, id?: string) => {
          const opts = id
            ? {
                where: Object.fromEntries(id.split('|').map((val, i) => [cloudColumns[i], val])),
              }
            : {};
          return await ctx.orm.find(this.entity, opts);
        },
      });
      this.db.entity = this.entity;
      this.db.entityId = this.entityId;
      this.db.dest = 'db';
      this.db.module = this.module;
    } else {
      throw new Error('Cannot automatically build database bindings without @cloudId decorator');
    }
    if (!this.cloud) throw new Error('No cloud entity CRUD defined');
    this.cloud.entity = this.entity;
    this.cloud.entityId = this.entityId;
    this.cloud.idFields = this.idFields;
    this.cloud.dest = 'cloud';
    this.cloud.module = this.module;
  }
}

export class RpcBase implements RpcInterface {
  module: ModuleInterface;
  outputTable: RpcOutput;
  inputTable: RpcInput = {
    _args: { argType: 'TEXT[]', default: 'ARRAY[]::text[]', variadic: true, rawDefault: true },
  };
  helpDescription?: string;
  helpSampleUsage?: string;
  preTransactionCheck: PreTransactionCheck;
  postTransactionCheck: PostTransactionCheck;
  call: (
    dbId: string,
    dbUser: string,
    ctx: Context,
    ...args: string[]
  ) => Promise<RpcResponseObject<RpcOutput>[]>;

  init() {
    if (!this.module) throw new Error('No module established for this RPC');
    if (!this.call) throw new Error('No call established for this RPC');
    if (!this.outputTable) throw new Error('No output established for this RPC');
  }

  formatObjKeysToSnakeCase(obj: any) {
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [snakeCase(k), v]));
  }
  getRpcInput() {
    // https://www.postgresql.org/docs/current/sql-createfunction.html
    const inputArgs = [];
    let postArgs: string;
    for (const [k, v] of Object.entries(this.inputTable)) {
      if (typeof v === 'string') {
        // argName => argType syntax
        inputArgs.push(`${snakeCase(k)} ${v}`);
      } else {
        // argName => {argType, default, rawDefault, variadic}
        let defaultValue = v.default;
        if (!v.rawDefault) {
          if (typeof v.default === 'string') defaultValue = `'${v.default}'`;
          else if (typeof v.default === 'boolean') defaultValue = v.default ? 'TRUE' : 'FALSE';
          else if (v.default === null) defaultValue = 'NULL';
        }
        inputArgs.push(`${v.variadic ? 'VARIADIC' : ''} ${snakeCase(k)} ${v.argType} = ${defaultValue}`);
      }
    }

    if (Object.keys(this.inputTable).length === 1 && this.inputTable.hasOwnProperty('_args')) {
      // _args is a special name for passing a variadic without wrapping
      postArgs = '_args';
    } else {
      postArgs = `(SELECT array[${Object.keys(this.inputTable).map(snakeCase).join(', ')}]::varchar[])`;
    }

    return [inputArgs.join(', '), postArgs];
  }

  getInstallUninstallSql(key: string) {
    const finalInputNames = _.map(Object.keys(this.inputTable), snakeCase);
    const commonElements = _.intersection(finalInputNames, _.keys(this.outputTable));
    if (!!commonElements.length)
      throw new Error(
        `A variable name can't be both input and output in ${key} RPC: ${commonElements.join(', ')}`,
      );

    const [rpcInputArgs, rpcInputArgsForPost] = this.getRpcInput();

    const rpcOutputEntries = Object.entries(this.outputTable ?? {});
    const rpcOutputTable = rpcOutputEntries
      .map(([columnName, columnType]) => `${columnName} ${columnType}`)
      .join(', ');
    let afterInstallSql = `
        create or replace function ${snakeCase(key)}(${rpcInputArgs}) returns table (${rpcOutputTable})
        language plpgsql security definer
        as $$
        declare
          _content text;
        begin
          perform http.http_set_curlopt('CURLOPT_TIMEOUT_MS', '3600000');
          select content into _content
          from http.http_post(
            'http://${config.http.host}:8088/v1/db/rpc',
            json_build_object(
              'dbId', current_database(),
              'dbUser', SESSION_USER,
              'params', ${rpcInputArgsForPost},
              'modulename', '${this.module.name}',
              'methodname', '${key}',
              'preTransaction', '${this.preTransactionCheck}',
              'postTransaction', '${this.postTransactionCheck}'
            )::varchar,
            'application/json'
          );
          if json_typeof(_content::json) <> 'array' then
            if json_typeof(_content::json) = 'object' then
              raise exception 'Error: %', _content::json->>'message';
            else
              raise exception 'Error: %', _content;
            end if;
          end if;
          return query select
            ${
              rpcOutputEntries.length
                ? `${rpcOutputEntries
                    .map(([col, typ]) => `try_cast(j.s->>'${col}', NULL::${typ}) as ${col}`)
                    .join(', ')}`
                : ''
            }
          from (
            select json_array_elements(_content::json) as s
          ) as j;
        end;
        $$;
      `;
    if (this.helpDescription && this.helpSampleUsage) {
      const documentationObject = {
        description: this.helpDescription,
        sample_usage: this.helpSampleUsage,
      };
      afterInstallSql += format(
        'COMMENT ON FUNCTION %I IS %L;',
        snakeCase(key),
        JSON.stringify(documentationObject),
      );
    }
    const beforeUninstallSql = `
        DROP FUNCTION "${snakeCase(key)}";
      `;
    return { beforeUninstallSql, afterInstallSql };
  }
}

export class AwsSdkInvoker extends RpcBase {
  preTransactionCheck = PreTransactionCheck.WAIT_FOR_LOCK;
  postTransactionCheck = PostTransactionCheck.UNLOCK_ALWAYS;

  clientType: keyof AWS;

  outputTable = {
    result: 'json',
  } as const;

  getInstallUninstallSql(key: string) {
    const rpcOutputEntries = Object.entries(this.outputTable ?? {});
    const rpcOutputTable = rpcOutputEntries
      .map(([columnName, columnType]) => `${columnName} ${columnType}`)
      .join(', ');
    const inputEnumName = `${snakeCase(key)}_method_names`;
    const enumSql = this.getMethodNamesEnumCreateSql(inputEnumName);
    const afterInstallSql =
      enumSql +
      `
        create or replace function ${snakeCase(
          key,
        )}(method_name ${inputEnumName}, method_input json, region varchar default default_aws_region()) returns table (
          ${rpcOutputTable}
        )
        language plpgsql security definer
        as $$
        declare
          _content text;
        begin
          perform http.http_set_curlopt('CURLOPT_TIMEOUT_MS', '3600000');
          select content into _content
          from http.http_post(
            'http://${config.http.host}:8088/v1/db/rpc',
            json_build_object(
              'dbId', current_database(),
              'dbUser', SESSION_USER,
              'params', (SELECT array[method_name, method_input, region]::varchar[]),
              'modulename', '${this.module.name}',
              'methodname', '${key}',
              'preTransaction', '${this.preTransactionCheck}',
              'postTransaction', '${this.postTransactionCheck}'
            )::varchar,
            'application/json'
          );
          if json_typeof(_content::json) <> 'array' then
            if json_typeof(_content::json) = 'object' then
              raise exception 'Error: %', _content::json->>'message';
            else
              raise exception 'Error: %', _content;
            end if;
          end if;
          return query select
            ${
              rpcOutputEntries.length
                ? `${rpcOutputEntries
                    .map(([col, typ]) => `try_cast(j.s->>'${col}', NULL::${typ}) as ${col}`)
                    .join(', ')}`
                : ''
            }
          from (
            select json_array_elements(_content::json) as s
          ) as j;
        end;
        $$;
      `;
    const beforeUninstallSql = `
        DROP FUNCTION "${snakeCase(key)}"(${inputEnumName}, json, varchar);
        DROP TYPE ${inputEnumName};
      `;
    return { beforeUninstallSql, afterInstallSql };
  }

  private getMethodNamesEnumCreateSql(inputEnumName: string) {
    const dummyClient = new AWS({
      region: 'us-east-1',
      credentials: { accessKeyId: '', secretAccessKey: '' },
    });
    const methodNames = Object.getOwnPropertyNames(Object.getPrototypeOf(dummyClient[this.clientType]));
    const enumEntries = methodNames
      .filter(name => name !== 'constructor')
      .map(name => `'${name}'`)
      .join(',');
    return `create type ${inputEnumName} as enum (${enumEntries});`;
  }

  call = async (
    _dbId: string,
    _dbUser: string,
    ctx: Context,
    methodName: string,
    argsString: string,
    region: string,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    const clientWrapper = (await ctx.getAwsClient(region)) as AWS;
    const client = clientWrapper[this.clientType];
    const methodAsType: keyof typeof client = methodName as keyof typeof client;
    const args = JSON.parse(argsString);
    // @ts-ignore
    const fn = crudBuilder2<typeof client, typeof methodAsType>(methodAsType, input => input);

    const res = await fn(client, args);
    return [
      {
        result: JSON.stringify(_.omit(res, ['$metadata'])),
      },
    ];
  };

  constructor(clientType: keyof AWS, module: ModuleInterface) {
    super();
    this.clientType = clientType;
    this.module = module;
  }
}

export interface ModuleInterface {
  name: string;
  version?: string;
  dependencies: string[];
  provides?: {
    tables?: string[];
    functions?: { [key: string]: { description?: string; sample_usage?: string } };
    // TODO: What other PSQL things should be tracked?
    // Context is special, it is merged between all installed modules and becomes the input to the
    // mappers, which can then make use of logic defined and exposed through this that they depend
    // on, so things like the `awsClient` just becomes part of the responsibility of the
    // `aws_account` module, for instance.
    context?: Context;
  };
  rpc?: { [key: string]: RpcInterface };
  migrations?: {
    beforeInstall?: (q: QueryRunner) => Promise<void>;
    install: (q: QueryRunner) => Promise<void>;
    afterInstall?: (q: QueryRunner) => Promise<void>;
    beforeRemove?: (q: QueryRunner) => Promise<void>;
    remove: (q: QueryRunner) => Promise<void>;
    afterRemove?: (q: QueryRunner) => Promise<void>;
  };
}

export class ModuleBase {
  dirname: string;
  name: string;
  version: string;
  dependencies: string[];
  provides: {
    entities: { [key: string]: any };
    tables: string[];
    functions: { [key: string]: { description?: string; sample_usage?: string; signature?: string } };
    context?: Context;
  };
  context?: Context;
  rpc?: { [key: string]: RpcInterface };
  migrations: {
    beforeInstall?: (q: QueryRunner) => Promise<void>;
    install: (q: QueryRunner) => Promise<void>;
    afterInstall?: (q: QueryRunner) => Promise<void>;
    beforeRemove?: (q: QueryRunner) => Promise<void>;
    remove: (q: QueryRunner) => Promise<void>;
    afterRemove?: (q: QueryRunner) => Promise<void>;
  };

  private getRpcSql(): [string, string] {
    let finalAfterInstallSql = '';
    let finalBeforeUninstallSql = '';
    for (const [key, rpc] of Object.entries(this.rpc ?? {})) {
      const { beforeUninstallSql, afterInstallSql } = rpc.getInstallUninstallSql(key);
      finalAfterInstallSql += afterInstallSql;
      finalBeforeUninstallSql = beforeUninstallSql + finalBeforeUninstallSql;
    }
    return [finalAfterInstallSql, finalBeforeUninstallSql];
  }

  private getCustomSql() {
    const beforeInstallSql = this.readSqlDir('before_install') ?? '';
    const afterInstallSql = this.readSqlDir('after_install') ?? '';
    const beforeUninstallSql = this.readSqlDir('before_uninstall') ?? '';
    const afterUninstallSql = this.readSqlDir('after_uninstall') ?? '';
    return {
      beforeInstallSql,
      afterInstallSql,
      beforeUninstallSql,
      afterUninstallSql,
    };
  }

  private readSqlDir(sqlFile: string) {
    try {
      return fs.readFileSync(`${this.dirname}/sql/${sqlFile}.sql`, 'utf8');
    } catch (_) {
      /** Don't do anything if the default file is not there */
    }
  }

  init() {
    this.loadBasics();
    this.loadTypeORM();
  }

  loadBasics() {
    if (!this.dirname) {
      this.dirname =
        path.dirname(callsite()?.[2]?.getFileName?.()) ??
        throwError('Invalid module definition. No `dirname` property found');
    }
    // Extract the name and version from `__dirname`
    const pathSegments = this.dirname.split(path.sep);
    const name = pathSegments[pathSegments.length - 1];
    const version = config.version;
    this.name = name;
    this.version = version;
    if (!this.dependencies) this.dependencies = require(`${this.dirname}/module.json`).dependencies;
    // Patch the dependencies list if not explicitly versioned
    this.dependencies = this.dependencies.map(dep => (dep.includes('@') ? dep : `${dep}@${this.version}`));
    // Make sure every module depends on the `iasql_platform` module (except that module itself)
    if (this.name !== 'iasql_platform' && !this.dependencies.includes(`iasql_platform@${this.version}`))
      throw new Error(`${this.name} did not declare an iasql_platform dependency and cannot be loaded.`);
    this.rpc = Object.fromEntries(
      Object.entries(this).filter(([, m]: [string, any]) => m instanceof RpcBase) as [[string, RpcInterface]],
    );
    const { beforeInstallSql, afterInstallSql, beforeUninstallSql, afterUninstallSql } = this.getCustomSql();
    const [rpcAfterInstallSql, rpcBeforeUninstallSql] = this.getRpcSql();
    this.provides = {
      entities: {},
      tables: [],
      functions: {},
    };
    if (this.context) this.provides.context = this.context;
    this.migrations = {
      install: async (_q: QueryRunner) => undefined,
      remove: async (_q: QueryRunner) => undefined,
    };
    const afterInstallMigration = afterInstallSql + rpcAfterInstallSql;
    const beforeUninstallMigration = rpcBeforeUninstallSql + beforeUninstallSql;
    if (beforeInstallSql) {
      this.provides.tables.push(...this.getTablesFromSql(beforeInstallSql));
      this.provides.functions = { ...this.provides.functions, ...this.getFunctionsFromSql(beforeInstallSql) };
      this.migrations.beforeInstall = async (q: QueryRunner) => {
        await q.query(beforeInstallSql);
      };
    }
    if (afterInstallMigration) {
      this.provides.tables.push(...this.getTablesFromSql(afterInstallMigration));
      this.provides.functions = {
        ...this.provides.functions,
        ...this.getFunctionsFromSql(afterInstallMigration),
      };
      this.migrations.afterInstall = async (q: QueryRunner) => {
        await q.query(afterInstallMigration);
      };
    }
    if (beforeUninstallMigration) {
      this.migrations.beforeRemove = async (q: QueryRunner) => {
        await q.query(beforeUninstallMigration);
      };
    }
    if (afterUninstallSql) {
      this.migrations.afterRemove = async (q: QueryRunner) => {
        await q.query(afterUninstallSql);
      };
    }
  }

  getTablesFromSql(sql: string): string[] {
    try {
      const sqlParsed = parse(sql);
      return sqlParsed
        .filter((s: any) => Object.keys(s.RawStmt?.stmt ?? {}).includes('CreateStmt'))
        .map((s: any) => {
          return s.RawStmt?.stmt?.CreateStmt?.relation?.relname;
        })
        .filter((v: string | undefined) => !!v);
    } catch (_) {
      /** Do nothing */
    }
    return [];
  }

  getFunctionsFromSql(sql: string): {
    [key: string]: { description?: string; sample_usage?: string; signature?: string };
  } {
    const returnValue: {
      [key: string]: { description?: string; sample_usage?: string; signature?: string };
    } = {};
    try {
      const sqlParsed = parse(sql);
      const functionsAndParams = sqlParsed
        .filter((s: any) => _.has(s, ['RawStmt', 'stmt', 'CreateFunctionStmt']))
        .map((s: any) => s.RawStmt.stmt.CreateFunctionStmt)
        .map((s: any) => [s.funcname?.pop()?.String?.str, s.parameters])
        .filter((v: any[]) => !!v[0]);

      for (const [functionName, functionParams] of functionsAndParams) {
        const inputs: string[] = [],
          outputs: string[] = [];
        functionParams?.map((p: any) => {
          if (['FUNC_PARAM_IN', 'FUNC_PARAM_VARIADIC'].includes(p.FunctionParameter.mode)) {
            const variadic = p.FunctionParameter.mode === 'FUNC_PARAM_VARIADIC';
            inputs.push(
              `${variadic ? 'variadic ' : ''}${p.FunctionParameter.name} ${
                p.FunctionParameter.argType?.names?.pop()?.String?.str
              }${variadic ? '[]' : ''}`,
            );
          } else
            outputs.push(
              `${p.FunctionParameter.name} ${p.FunctionParameter.argType?.names?.pop()?.String?.str}`,
            );
        });
        returnValue[functionName] = { signature: `(${inputs.join(', ')}) => (${outputs.join(', ')})` };
      }

      sqlParsed
        .filter((s: any) => _.has(s, ['RawStmt', 'stmt', 'CommentStmt']))
        .map((s: any) => {
          return [
            s.RawStmt.stmt.CommentStmt.object?.ObjectWithArgs?.objname?.pop().String?.str,
            safeParse(s.RawStmt.stmt.CommentStmt.comment),
          ];
        })
        .filter((v: any[]) => !!v[0] && !!v[1])
        .map((v: [string, { description?: string; sample_usage?: string }]) => {
          returnValue[v[0]] = {
            ...returnValue[v[0]],
            description: v[1].description,
            sample_usage: v[1].sample_usage,
          };
        });
      return returnValue;
    } catch (_) {
      /** Do nothing */
    }
    return {};
  }

  loadTypeORM() {
    const migrationDir = `${this.dirname}/migration`;
    const files = fs.readdirSync(migrationDir).filter(f => !/.map$/.test(f));
    if (files.length !== 1) throw new Error('Cannot determine which file is the migration');
    const migration = require(`${migrationDir}/${files[0]}`);
    // Assuming TypeORM migration files
    const migrationClass = migration[Object.keys(migration)[0]];
    if (!migrationClass || !migrationClass.prototype.up || !migrationClass.prototype.down) {
      throw new Error('Presumed migration file is not a TypeORM migration');
    }
    this.migrations.install = migrationClass.prototype.up;
    this.migrations.remove = migrationClass.prototype.down;
    const entityDir = `${this.dirname}/entity`;
    this.provides.entities = require(`${entityDir}/index`);
    const syncified = new Function(
      'return ' +
        migrationClass.prototype.up
          .toString()
          .replace(/\basync\b/g, '')
          .replace(/\bawait\b/g, '')
          .replace(/^/, 'function')
          // The following are only for the test suite, but need to be included at all times
          .replace(/\/* istanbul ignore next *\//g, '')
          .replace(/cov_.*/g, '')
          // Drop any lines that don't have backticks because they must be handwritten add-ons
          // to the migration file (TODO: Avoid this hackery somehow)
          .split('\n')
          .filter((l: string) => !/query\(/.test(l) || /`/.test(l))
          .join('\n'),
    )();
    const tables: string[] = [];
    const functions: string[] = [];
    syncified({
      query: (text: string) => {
        // TODO: Proper parsing (maybe LP?)
        if (/^create table/i.test(text)) {
          tables.push((text.match(/^[^"]*"([^"]*)"/) ?? [])[1]);
        } else if (/^create or replace procedure/i.test(text)) {
          functions.push((text.match(/^create or replace procedure ([^(]*)/i) ?? [])[0] ?? '');
        } else if (/^create or replace function/i.test(text)) {
          functions.push((text.match(/^create or replace function ([^(]*)/i) ?? [])[0] ?? '');
        }
        // Don't do anything for queries that don't match
      },
    });
    this.provides.tables = tables;
    this.provides.functions = Object.fromEntries(functions.map(name => [name, {}]));
  }
}
