import { QueryRunner, } from 'typeorm'

export type Context = { [key: string]: any };

export interface CrudInterface<E> {
  create: (e: E | E[], ctx: Context) => Promise<void | E | E[]>;
  read: (ctx: Context, id?: string | string[]) => Promise<E | E[]>;
  update: (e: E | E[], ctx: Context) => Promise<void | E | E[]>;
  delete: (e: E | E[], ctx: Context) => Promise<void | E | E[]>;
}

export class Crud<E> {
  createFn: (e: E | E[], ctx: Context) => Promise<void | E | E[]>;
  readFn: (ctx: Context, id?: string | string[]) => Promise<E | E[]>;
  updateFn: (e: E | E[], ctx: Context) => Promise<void | E | E[]>;
  deleteFn: (e: E | E[], ctx: Context) => Promise<void | E | E[]>;
  dest?: 'db' | 'cloud';
  entityName?: string;
  entityId?: (e: E) => string;
  
  constructor(def: CrudInterface<E>) {
    this.createFn = def.create;
    this.readFn = def.read;
    this.updateFn = def.update
    this.deleteFn = def.delete;
  }

  memo(e: void | E | E[], ctx: Context) {
    if (!e) return;
    const es = Array.isArray(e) ? e : [e];
    const dest = this.dest ?? 'What?';
    const entityName = this.entityName ?? 'What?';
    const entityId = this.entityId ?? function (_e: E) { return 'What?'; };
    es.forEach(e => {
      ctx.memo[dest] = ctx.memo[dest] ?? {};
      ctx.memo[dest][entityName] = ctx.memo[dest][entityName] ?? {};
      ctx.memo[dest][entityName][entityId(e)] = e;
    });
    return e;
  }

  // TODO: Add memoization of everything
  async create(e: E | E[], ctx: Context) {
    return this.memo(await this.createFn(e, ctx), ctx);
  }

  async read(ctx: Context, id?: string | string[]) {
    if (id) {
      const dest = this.dest ?? 'What?';
      const entityName = this.entityName ?? 'What?';
      if (Array.isArray(id)) {
        const missing: string[] = [];
        const vals = id.map(i => {
          const val = ctx.memo?.[dest]?.[entityName]?.[i];
          if (!val) {
            missing.push(i);
            return i;
          } else {
            return val;
          }
        });
        if (missing.length === 0) return vals;
        const missingVals = this.memo(await this.readFn(ctx, missing), ctx) as E[];
        // The order is the same in both lists, so we can cheat and do a single pass
        for (let i = 0, j = 0; i < vals.length; i++) {
          if (vals[i] === missing[j]) {
            vals[i] = missingVals[j];
            j++;
          }
        }
        return vals;
      } else {
        return ctx.memo?.[dest]?.[entityName]?.[id] ?? this.memo(await this.readFn(ctx, id), ctx);
      }
    }
    return this.memo(await this.readFn(ctx, id), ctx);
  }

  async update(e: E | E[], ctx: Context) {
    return this.memo(await this.updateFn(e, ctx), ctx);
  }

  async delete(e: E | E[], ctx: Context) {
    return await this.deleteFn(e, ctx);
  }
}

export interface MapperInterface<E> {
  entity:  { new (): E };
  entityId: (e: E) => string;
  equals: (a: E, b: E) => boolean;
  source: 'db' | 'cloud';
  db: Crud<E>;
  cloud: Crud<E>;
}

export class Mapper<E> {
  entity: { new(): E };
  entityId: (e: E) => string;
  equals: (a: E, b: E) => boolean;
  source: 'db' | 'cloud';
  db: Crud<E>;
  cloud: Crud<E>;

  constructor(def: MapperInterface<E>) {
    this.entity = def.entity;
    this.entityId = def.entityId;
    this.equals = def.equals;
    this.source = def.source;
    this.db = def.db;
    this.db.entityName = def.entity.name;
    this.db.entityId = def.entityId;
    this.db.dest = 'db';
    this.cloud = def.cloud;
    this.cloud.entityName = def.entity.name;
    this.cloud.entityId = def.entityId;
    this.cloud.dest = 'cloud';
  }
}

export interface ModuleInterface {
  name: string;
  //version: string; // TODO: Get versioning working
  dependencies: string[];
  provides: {
    tables?: string[];
    functions?: string[];
    // TODO: What other PSQL things should be tracked?
    // Context is special, it is merged between all installed modules and becomes the input to the
    // mappers, which can then make use of logic defined and exposed through this that they depend
    // on, so things like the `awsClient` just becomes part of the responsibility of the
    // `aws_account` module, for instance.
    context?: Context;
  };
  mappers: { [key: string]: Mapper<any>, };
  migrations: {
    // This part is modeled partly on Debian packages, and partly on Node packages. (It's mostly the
    // completeness of options that are taken from Node). There are four kinds of events encoded in
    // this: upgrade, downgrade, install, and remove.
    //
    // Upgrade and Downgrade are when the module is already installed and the version is being
    // changed. Install is when the module is not present and the version in question is being
    // added, and Remove is for getting rid of the module.
    //
    // The Pre- and Post- prefixes on these events are for the ordering that it will be called in
    // relation to any dependencies that also need to have a migration run. The Pre- prefix means
    // that it will run *before* all of its dependencies' runs, and the Post- prefix for *after* all
    // of its dependencies have run. (Like the double-bubbling in the browser event system, btw.)
    // Essentially this means that the dependency tree is linearized twice, first with the leaf
    // nodes being earlier in the list for all of the Pre- migrations to be run, then with the root
    // nodes being earlier in the list for all of the Post- migrations.
    //
    // In general, `install` and `remove` will almost always use only `postinstall` and `preremove`.
    // Why? When installing, you wait for the schemas for your dependencies to be set up, then you
    // run your own schema and attach the foreign key references from them to your own table(s), and
    // when you're removing, you need to remove your foreign key references and your tables before
    // your dependencies can be properly cleaned up.
    //
    // For `upgrade` and `downgrade`, though, it's likely that both `pre` and `post` will be used in
    // both directions when they are used. Why? If you're upgrading your library and also upgrading
    // the dependency version at the same time, if any columns you are attached to are changing or
    // are being removed, you need to run a migration before they are upgraded to detach your
    // foreign key(s) from them, and then after they are done you need to run a migration to
    // re-attach to (or otherwise deal with) the new schema.
    preup?: (q: QueryRunner) => Promise<void>;
    postup?: (q: QueryRunner) => Promise<void>;
    predown?: (q: QueryRunner) => Promise<void>;
    postdown?: (q: QueryRunner) => Promise<void>;
    preinstall?: (q: QueryRunner) => Promise<void>;
    postinstall?: (q: QueryRunner) => Promise<void>;
    preremove?: (q: QueryRunner) => Promise<void>;
    postremove?: (q: QueryRunner) => Promise<void>;
  };
}
