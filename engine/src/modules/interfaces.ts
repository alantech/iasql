import { QueryRunner, } from 'typeorm'

export type Context = { [key: string]: any };

export interface CrudInterface<E> {
  create: (e: E | E[], ctx: Context) => Promise<void | E>;
  read: (ctx: Context, options?: any) => Promise<E | E[]>;
  update: (e: E | E[], ctx: Context) => Promise<void | E>;
  delete: (e: E | E[], ctx: Context) => Promise<void | E>;
}

export interface MapperInterface<E> {
  entity:  { new (): E };
  entityId: (e: E) => string;
  equals: (a: E, b: E) => boolean;
  source: 'db' | 'cloud';
  db: CrudInterface<E>;
  cloud: CrudInterface<E>;
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
  mappers: { [key: string]: MapperInterface<any>, };
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
