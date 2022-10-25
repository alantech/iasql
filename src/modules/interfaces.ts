import callsite from 'callsite';
import fs from 'fs';
import path from 'path';
import { QueryRunner, getMetadataArgsStorage, ColumnType } from 'typeorm';
import { snakeCase } from 'typeorm/util/StringUtils';

import { throwError } from '../config/config';
import { getCloudId } from '../services/cloud-id';
import logger from '../services/logger';

// The exported interfaces are meant to provide better type checking both at compile time and in the
// editor. They *shouldn't* have to be ever imported directly, only the classes ought to be, but as
// the classes use these interfaces it helps give you hints as you develop a lot better than without
// them.

export type IdFields = { [key: string]: string };

export type Context = { [key: string]: any };

// TODO: use something better than ColumnType for possible postgres colum types
export type RpcOutput = { [key: string]: ColumnType };

export type RpcResponseObject<T> = { [Properties in keyof T]: any };

export interface CrudInterface2<E> {
  create: (e: E[], ctx: Context) => Promise<void | E[]>;
  read: (ctx: Context, id?: string) => Promise<E[] | E | void>;
  updateOrReplace?: (prev: E, next: E) => 'update' | 'replace';
  update: (e: E[], ctx: Context) => Promise<void | E[]>;
  delete: (e: E[], ctx: Context) => Promise<void | E[]>;
}

export class Crud2<E> {
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
    logger.info(`Calling ${this.entity?.name ?? ''} ${this.dest} create`);
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
    logger.info(`Calling ${this.entity?.name ?? ''} ${this.dest} read ${id}`);
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
        logger.info(`Cache miss for ${this.entity?.name ?? ''} ${this.dest}`);
        ctx.memo[dest][entityName][id] = new (this.entity as new () => E)();
      } else {
        // If object is empty it means it is a placeholder and it is not in the memo yet.
        if (!Object.keys(ctx.memo[dest][entityName][id]).length) {
          logger.info(`Cache miss for ${this.entity?.name ?? ''} ${this.dest}`);
        } else {
          logger.info(`Cache hit for ${this.entity?.name ?? ''} ${this.dest}`);
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
    logger.info(`Full cache miss for ${this.entity?.name ?? ''} ${this.dest}`);
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
    logger.info(`Calling ${this.entity?.name ?? ''} ${this.dest} update`);
    const es = Array.isArray(e) ? e : [e];
    try {
      return this.memo(await this.updateFn(es, ctx), ctx, e);
    } catch (err: any) {
      err.message = `${this.entity?.name} ${this.dest} update error: ${err.message}`;
      throw err;
    }
  }

  async delete(e: E | E[], ctx: Context) {
    logger.info(`Calling ${this.entity?.name ?? ''} ${this.dest} delete`);
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
export interface MapperInterface<E> {
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
  call: (
    dbId: string,
    dbUser: string,
    ctx: Context,
    ...args: string[]
  ) => Promise<RpcResponseObject<RpcOutput>[]>;
}

export class MapperBase<E> {
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
              `Id generation error. Valid fields to generate id are: ${cloudColumns.join(', ')}`,
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
            throw new Error(`Id generation error. Valid field to generate id is: ${primaryColumn}`);
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

export class RpcBase {
  module: ModuleInterface;
  outputTable: RpcOutput;
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
}

export interface ModuleInterface {
  name: string;
  version?: string;
  dependencies: string[];
  provides?: {
    tables?: string[];
    functions?: string[];
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
    functions: string[];
    context?: Context;
  };
  context?: Context;
  // TODO: delete after v0.0.20 is deleted
  sql?: {
    afterInstallSqlPath?: string;
    beforeUninstallSqlPath?: string;
  };
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
    let afterInstallSql = '';
    let beforeUninstallSql = '';
    for (const [key, rpc] of Object.entries(this.rpc ?? {})) {
      const rpcOutputEntries = Object.entries(rpc.outputTable ?? {});
      const rpcOutputTable = rpcOutputEntries
        .map(([columnName, columnType]) => `${columnName} ${columnType}`)
        .join(', ');
      afterInstallSql += `
        create or replace function ${snakeCase(
          key,
        )}(variadic _args text[] default array[]::text[]) returns table (
          ${rpcOutputTable}
        )
        language plpgsql security definer
        as $$
        declare
          _opid uuid;
        begin
          _opid := until_iasql_rpc('${this.name}', '${key}', _args);
          return query select
            ${
              rpcOutputEntries.length
                ? `${rpcOutputEntries
                    .map(([col, typ]) => `try_cast(j.s->>'${col}', NULL::${typ}) as ${col}`)
                    .join(', ')}`
                : ''
            }
          from (
            select json_array_elements(output::json) as s from iasql_rpc where opid = _opid
          ) as j;
        end;
        $$;
      `;
      beforeUninstallSql =
        `
        DROP FUNCTION "${snakeCase(key)}";
      ` + beforeUninstallSql;
    }
    return [afterInstallSql, beforeUninstallSql];
  }

  private getCustomSql() {
    const beforeInstallSql = this.readSqlDir('before_install') ?? '';
    // TODO: delete customDir param after v0.0.20 is deleted
    const afterInstallSql = this.readSqlDir('after_install', this.sql?.afterInstallSqlPath) ?? '';
    // TODO: delete customDir param after v0.0.20 is deleted
    const beforeUninstallSql = this.readSqlDir('before_uninstall', this.sql?.beforeUninstallSqlPath) ?? '';
    const afterUninstallSql = this.readSqlDir('after_uninstall') ?? '';
    return {
      beforeInstallSql,
      afterInstallSql,
      beforeUninstallSql,
      afterUninstallSql,
    };
  }

  // TODO: delete customDir param after v0.0.20 is deleted
  private readSqlDir(sqlFile: string, customDir?: string) {
    try {
      // If no customDir specified, try to get the default
      return fs.readFileSync(`${this.dirname}/${customDir ? `${customDir}` : `sql/${sqlFile}.sql`}`, 'utf8');
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
    const version = pathSegments[pathSegments.length - 2];
    this.name = name;
    this.version = version;
    if (!this.dependencies) this.dependencies = require(`${this.dirname}/module.json`).dependencies;
    // Patch the dependencies list if not explicitly versioned
    this.dependencies = this.dependencies.map(dep => (dep.includes('@') ? dep : `${dep}@${this.version}`));
    // Make sure every module depends on the `iasql_platform` module (except that module itself)
    if (this.name !== 'iasql_platform' && !this.dependencies.includes(`iasql_platform@${this.version}`))
      throw new Error(`${this.name} did not declare an iasql_platform dependency and cannot be loaded.`);
    this.rpc = Object.fromEntries(
      Object.entries(this).filter(([_, m]: [string, any]) => m instanceof RpcBase) as [
        [string, RpcInterface],
      ],
    );
    const { beforeInstallSql, afterInstallSql, beforeUninstallSql, afterUninstallSql } = this.getCustomSql();
    const [rpcAfterInstallSql, rpcBeforeUninstallSql] = this.getRpcSql();
    this.provides = {
      entities: {},
      tables: [],
      functions: [],
    };
    if (/^create table/i.test(afterInstallSql)) {
      this.provides.tables.push((afterInstallSql.match(/^[^"]*"([^"]*)"/) ?? [])[1]);
    }
    if (this.context) this.provides.context = this.context;
    this.migrations = {
      install: async (_q: QueryRunner) => undefined,
      remove: async (_q: QueryRunner) => undefined,
    };
    const afterInstallMigration = afterInstallSql + rpcAfterInstallSql;
    const beforeUninstallMigration = rpcBeforeUninstallSql + beforeUninstallSql;
    if (beforeInstallSql) {
      this.migrations.beforeInstall = async (q: QueryRunner) => {
        await q.query(beforeInstallSql);
      };
    }
    if (afterInstallMigration) {
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
          functions.push((text.match(/^create or replace procedure ([^(]*)/i) ?? [])[0]);
        } else if (/^create or replace function/i.test(text)) {
          functions.push((text.match(/^create or replace function ([^(]*)/i) ?? [])[0]);
        }
        // Don't do anything for queries that don't match
      },
    });
    this.provides.tables = tables;
    this.provides.functions = functions;
  }
}
