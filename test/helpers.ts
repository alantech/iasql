import { execSync, } from 'child_process'

import { createConnection, } from 'typeorm'

import * as iasql from '../src/services/iasql'

export function execComposeUp() {
  execSync('cd test && docker-compose up -d && sleep 5');
}

export async function execComposeDown(modules?: string[], region?: string) {
  if (modules?.length) await cleanDB(modules, region);
  execSync('cd test && docker-compose down');
}

export function getPrefix(){
  const lowerCaseLetters = Array(26).fill('a').map((c, i) => String.fromCharCode(c.charCodeAt() + i));
  const digits = Array(10).fill('0').map((c, i) => String.fromCharCode(c.charCodeAt() + i));
  const chars = [ lowerCaseLetters, digits, ].flat();
  const randChar = (): string => chars[Math.floor(Math.random() * chars.length)];
  const randLetter = (): string => lowerCaseLetters[Math.floor(Math.random() * lowerCaseLetters.length)];
  return randLetter() + Array(6).fill('').map(() => randChar()).join('');
}

export function finish(done: (e?: any) => {}) {
  return [() => done(), (e: any) => { done(e); }];
}

export function runApply(dbAlias: string, done: (e?: any) => {}) {
  iasql.apply(dbAlias, false, 'not-needed').then(...finish(done));
}

export function runSync(dbAlias: string, done: (e?: any) => {}) {
  iasql.sync(dbAlias, false, 'not-needed').then(...finish(done));
}

export function runQuery(dbAlias: string, queryString: string, assertFn?: (res: any[]) => void) {
  return function (done: (e?: any) => {}) {
    console.log(queryString);
    createConnection({
      name: dbAlias,
      type: 'postgres',
      username: 'postgres',
      password: 'test',
      host: 'localhost',
      port: 5432,
      database: dbAlias,
      extra: { ssl: false, },
    }).then((conn) => {
      conn.query(queryString).then((res: any[]) => {
        conn.close().then(...finish((_e?: any) => {
          if (assertFn) {
            try {
              assertFn(res);
            } catch (e: any) {
              done(e);
              return {};
            }
          }
          done();
          return {};
        }));
      }, (e) => {
        conn.close().then(() => done(e), (e2) => done(e2));
      });
    }, done);
  }
}

async function cleanDB(modules: string[], region: string | undefined): Promise<void> {
  const dbAlias = `cleandb${Date.now()}`;
  const awsRegion = region ?? process.env.AWS_REGION ?? 'barf';
  console.log(`Cleaning ${dbAlias} in ${awsRegion}...`);
  await iasql.add(dbAlias, awsRegion, process.env.AWS_ACCESS_KEY_ID ?? 'barf', process.env.AWS_SECRET_ACCESS_KEY ?? 'barf', 'not-needed');
  console.log('DB created...');
  await iasql.install(modules, dbAlias, 'not-needed');
  console.log(`Modules ${modules} installed...`);
  const conn = await createConnection({
    name: dbAlias,
    type: 'postgres',
    username: 'postgres',
    password: 'test',
    host: 'localhost',
    port: 5432,
    database: dbAlias,
    extra: { ssl: false, },
  });
  console.log(`Connection created...`);
  await conn.query(`
    DO $$
    DECLARE 
      loop_count integer := 0;
      tables_array_lenght integer;
      tables_array text[];
      aux_tables_array text[];
      aws_region text;
    BEGIN
      SELECT region INTO aws_region FROM aws_account;
      SELECT ARRAY(SELECT "table" FROM iasql_tables) INTO tables_array;
      SELECT array_length(tables_array, 1) INTO tables_array_lenght;
      WHILE tables_array_lenght > 0 AND loop_count < 20 LOOP 
        SELECT tables_array INTO aux_tables_array;
        FOR table_elem IN array_lower(aux_tables_array, 1)..array_upper(aux_tables_array, 1) LOOP
          BEGIN
            raise notice 'logging table %', aux_tables_array[table_elem];
            IF aux_tables_array[table_elem] = 'public_repository' THEN
              raise notice '%', format('DELETE FROM %I WHERE repository_name LIKE ''%s''', aux_tables_array[table_elem], '%' || aws_region);
              EXECUTE format('DELETE FROM %I WHERE repository_name LIKE ''%s''', aux_tables_array[table_elem], '%' || aws_region);
              SELECT array_remove(tables_array, aux_tables_array[table_elem]) INTO tables_array;
            ELSE
              EXECUTE format('DELETE FROM %I', aux_tables_array[table_elem]);
              SELECT array_remove(tables_array, aux_tables_array[table_elem]) INTO tables_array;
            END IF;
            EXECUTE format('DELETE FROM %I', aux_tables_array[table_elem]);
            SELECT array_remove(tables_array, aux_tables_array[table_elem]) INTO tables_array;
          EXCEPTION
            WHEN others THEN 
              -- we ignore the error
            END;
        END LOOP;
        SELECT array_length(tables_array, 1) INTO tables_array_lenght; 
        loop_count := loop_count + 1;
      END LOOP;
    END$$;
  `);
  await conn.close();
  const res = await iasql.apply(dbAlias, false, 'not-needed');
  console.log('Deletes applied...');
  console.dir(res, {depth: 6});
  await iasql.remove(dbAlias, 'not-needed');
  console.log('DB removed...');
}
