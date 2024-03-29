/* tslint:disable no-console */
import { createConnection } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

import { sortMods, getModMigration, getModBeforeInstall } from './module-json-utils';

const moduleName = process.argv[process.argv.length - 1];

let sortedDeps = sortMods(moduleName, false);

// TODO: Remove this hackery once typeorm migration doesn't do weird alter table crap
if (moduleName !== 'iasql_platform') {
  sortedDeps = sortedDeps.filter(d => d.name !== 'iasql_platform');
}

const entities = sortedDeps.map(d => `${__dirname}/../modules/${d.name}/entity/*.ts`) as any[];

(async () => {
  const conn = await createConnection({
    type: 'postgres',
    name: '__example__',
    database: '__example__',
    host: 'localhost',
    username: 'postgres',
    password: 'test',
    namingStrategy: new SnakeNamingStrategy(),
    entities,
  });

  const qr = conn.createQueryRunner();

  for (const dep of sortedDeps) {
    console.log(`Adding ${dep.name} before install...`);
    const beforeInstallSql = getModBeforeInstall(dep.name);
    await qr.query(beforeInstallSql);
    console.log(`Adding ${dep.name} migration...`);
    const migrationClass = getModMigration(dep.name);
    await migrationClass.prototype.up(qr);
  }
  console.log('Done!');
  process.exit(0);
})();
