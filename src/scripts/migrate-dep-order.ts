import { sortMods, getModMigration, } from './module-json-utils'
import { TypeormWrapper, } from '../services/typeorm'

const moduleName = process.argv[process.argv.length - 1];

let sortedDeps = sortMods(moduleName, false);

// TODO: Remove this hackery once typeorm migration doesn't do weird alter table crap
if (moduleName !== 'iasql_platform') {
  sortedDeps = sortedDeps.filter(d => d.name !== 'iasql_platform');
}

const entities = sortedDeps.map(d => `${__dirname}/../modules/0.0.1/${d.name}/entity/*.ts`) as any[]

(async () => {
  const conn = await TypeormWrapper.createConn('__example__', {
    entities,
    host: 'localhost',
    username: 'postgres',
    password: 'test',
  });

  const qr = conn.createQueryRunner();

  for (const dep of sortedDeps) {
    console.log(`Adding ${dep.name}...`);
    const migrationClass = getModMigration(dep.name);
    await migrationClass.prototype.up(qr);
  }
  console.log('Done!');
  process.exit(0);
})();