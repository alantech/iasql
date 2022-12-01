// TODO: It seems like a lot of this logic could be migrated into the iasql_platform module and make
// sense there. Need to think a bit more on that, but module manipulation that way could allow for
// meta operations within the module code itself, if desirable.
import { exec as execNode } from 'child_process';
import pg from 'pg';
import { parse, deparse } from 'pgsql-parser';
import { createConnection } from 'typeorm';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';

import { IasqlDatabase } from '../entity';
import { isString } from './common';
import * as dbMan from './db-manager';
import logger from './logger';
import MetadataRepo from './repositories/metadata';
import { TypeormWrapper } from './typeorm';

const exec = promisify(execNode);

export async function getDbRecCount(conn: TypeormWrapper): Promise<number> {
  // only looks at the public schema
  const res = await conn.query(`
    SELECT SUM(
      (xpath('/row/count/text()', query_to_xml('SELECT COUNT(*) FROM ' || format('%I.%I', table_schema, table_name), true, true, '')))[1]::text::int
    )
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name NOT LIKE 'iasql_%'
  `);
  return parseInt(res[0].sum ?? '0', 10);
}

// TODO: connect and disconnect to be turned into metadata RPCs
export async function connect(dbAlias: string, uid: string, email: string, dbId = dbMan.genDbId(dbAlias)) {
  let conn1: any, conn2: any, dbUser: any;
  let dbSaved,
    roleGranted = false;
  try {
    logger.info('Creating account for user...');
    const dbGen = dbMan.genUserAndPass();
    dbUser = dbGen[0];
    const dbPass = dbGen[1];
    const metaDb = new IasqlDatabase();
    metaDb.alias = dbAlias;
    metaDb.pgUser = dbUser;
    metaDb.pgName = dbId;
    await MetadataRepo.saveDb(uid, email, metaDb);
    dbSaved = true;
    logger.info('Establishing DB connections...');
    conn1 = await createConnection(dbMan.baseConnConfig);
    await conn1.query(`
      CREATE DATABASE ${dbId};
    `);
    conn2 = await createConnection({
      ...dbMan.baseConnConfig,
      name: dbId,
      database: dbId,
    });
    await dbMan.migrate(conn2);
    await conn2.query('CREATE SCHEMA http; CREATE EXTENSION http WITH SCHEMA http;');
    await conn2.query(dbMan.setUpDblink(dbId));
    await conn2.query(`SELECT * FROM query_cron('schedule');`);
    await conn2.query(`SELECT * FROM query_cron('schedule_purge');`);
    await conn2.query(dbMan.createDbPostgreGroupRole(dbId));
    await conn2.query(dbMan.newPostgresRoleQuery(dbUser, dbPass, dbId));
    await conn2.query(dbMan.grantPostgresGroupRoleQuery(dbUser, dbId));
    roleGranted = true;
    const recCount = await getDbRecCount(conn2);
    const opCount = 0;
    // TODO: UPDATE BY THE TIME 0.0.20 BECOMES UNSUPPORTED
    // TODO: Update what? I don't understand this TODO
    await MetadataRepo.updateDbCounts(dbId, recCount, opCount);
    logger.info('Done!');
    // Return custom IasqlDatabase object since we need to return the password
    return {
      user: dbUser,
      password: dbPass,
      recordCount: recCount,
      operationCount: opCount,
      alias: dbAlias,
      id: dbId,
    };
  } catch (e: any) {
    // delete db in psql and metadata
    if (dbSaved) await conn1?.query(`DROP DATABASE IF EXISTS ${dbId} WITH (FORCE);`);
    if (dbUser && roleGranted) await conn1?.query(dbMan.dropPostgresRoleQuery(dbUser, dbId, true));
    if (dbSaved) await MetadataRepo.delDb(uid, dbAlias);
    // rethrow the error
    throw e;
  } finally {
    await conn1?.close();
    await conn2?.close();
  }
}

export async function disconnect(dbAlias: string, uid: string) {
  let conn;
  try {
    const db: IasqlDatabase = await MetadataRepo.getDb(uid, dbAlias);
    console.log(`+-+ CREATING MAIN CONN`)
    conn = await createConnection(dbMan.baseConnConfig);
    // Cancel all connections
    console.log(`+-+ REVOKE CONNECT ON DATABASE ${db.pgName} FROM PUBLIC`)
    await conn.query(`REVOKE CONNECT ON DATABASE ${db.pgName} FROM PUBLIC;`);
    // Unschedule all jobs
    console.log(`+-+ MetadataRepo.unscheduleJobs`)
    await MetadataRepo.unscheduleJobs(db.pgName);
    // Kill all open connections https://stackoverflow.com/questions/5108876/kill-a-postgresql-session-connection
    console.log(`+-+ Kill all open connections`)
    const res = await conn.query(`
    SELECT
      pid
    FROM
      pg_stat_activity
    WHERE
      -- don't kill my own connection!
      pid <> pg_backend_pid()
      -- don't kill the connections to other databases
      AND datname = '${db.pgName}';
    `);  
    console.log(`+-+ ${
      JSON.stringify(res)
    }`)
    await conn.query(`
      SELECT
        pg_terminate_backend(pid)
      FROM
        pg_stat_activity
      WHERE
        -- don't kill my own connection!
        pid <> pg_backend_pid()
        -- don't kill the connections to other databases
        AND datname = '${db.pgName}';
    `);
    console.log(`+-+ DROP DATABASE IF EXISTS`)
    await conn.query(`
      DROP DATABASE IF EXISTS ${db.pgName} WITH (FORCE);
    `);
    await conn.query(dbMan.dropPostgresRoleQuery(db.pgUser, db.pgName, true));
    await MetadataRepo.delDb(uid, dbAlias);
    return db.pgName;
  } catch (e: any) {
    console.log(`+-+ THROWING HERE ${e}`)
    // re-throw
    throw e;
  } finally {
    conn?.close();
  }
}

export async function runSql(dbAlias: string, uid: string, sql: string, byStatement: boolean) {
  let connMain: any, connTemp: any;
  const user = `_${uuidv4().replace(/-/g, '')}`;
  const pass = `_${uuidv4().replace(/-/g, '')}`;
  const db: IasqlDatabase = await MetadataRepo.getDb(uid, dbAlias);
  if (db?.upgrading) throw new Error('Currently upgrading, cannot query at this time');
  const database = db.pgName;
  try {
    connMain = await createConnection({ ...dbMan.baseConnConfig, database, name: pass });
    // Apparently GRANT and REVOKE can run into concurrency issues in Postgres. Serializing it would
    // be best, but https://www.postgresql.org/message-id/3473.1393693757%40sss.pgh.pa.us says that
    // just retrying ought to work. Doing this in a simple do-while loop with a counter to abort if
    // too many attempts occur.
    let maxTries = 10;
    let success = true;
    do {
      try {
        await connMain.query(dbMan.newPostgresRoleQuery(user, pass, database));
        success = true;
      } catch (_) {
        success = false;
      }
      maxTries--;
    } while (!success && maxTries);
    maxTries = 10;
    success = true;
    do {
      try {
        await connMain.query(dbMan.grantPostgresGroupRoleQuery(user, database));
        success = true;
      } catch (_) {
        success = false;
      }
      maxTries--;
    } while (!success && maxTries);
    const out = [];
    if (byStatement) {
      const stmts = parse(sql);
      for (const stmt of stmts) {
        connTemp = new pg.Client({
          database,
          user,
          password: pass,
          host: dbMan.baseConnConfig.host,
          ssl: dbMan.baseConnConfig.extra.ssl,
        });

        await connTemp.connect();
        await connTemp.query(dbMan.setPostgresRoleQuery(database));

        out.push({
          statement: deparse(stmt),
          queryRes: await connTemp.query(deparse(stmt)),
        });
        await connTemp.end();
      }
    } else {
      connTemp = new pg.Client({
        database,
        user,
        password: pass,
        host: dbMan.baseConnConfig.host,
        ssl: dbMan.baseConnConfig.extra.ssl,
      });

      await connTemp.connect();
      await connTemp.query(dbMan.setPostgresRoleQuery(database));
      const stmts = parse(sql);
      for (const stmt of stmts) {
        out.push(await connTemp.query(deparse(stmt)));
      }
    }
    // Let's make this a bit easier to parse. Error -> error path, single table -> array of objects,
    // multiple tables -> array of array of objects
    return out.map(t => {
      if (byStatement) {
        if (
          !!t.queryRes.rows &&
          t.queryRes.rows.length === 0 &&
          t.queryRes.command !== 'SELECT' &&
          typeof t.queryRes.rowCount === 'number'
        ) {
          return { statement: t.statement, affected_records: t.queryRes.rowCount };
        } else if (isString(t.queryRes)) {
          return { statement: t.statement, result: t.queryRes };
        } else if (!!t.queryRes.rows) {
          return { statement: t.statement, result: t.queryRes.rows };
        } else {
          return { statement: t.statement, error: `unexpected result: ${t.queryRes}` }; // TODO: Error this out
        }
      } else {
        if (!!t.rows && t.rows.length === 0 && t.command !== 'SELECT' && typeof t.rowCount === 'number') {
          return { affected_records: t.rowCount };
        } else if (isString(t)) {
          return { result: t };
        } else if (!!t.rows) {
          return t.rows;
        } else {
          return { error: `unexpected result: ${t}` }; // TODO: Error this out
        }
      }
    });
  } catch (e: any) {
    // re-throw
    throw e;
  } finally {
    // Put this in a timeout so it doesn't block returning to the user
    setTimeout(async () => {
      await connTemp?.end();
      // Same idea as above, but for the credential revocation
      let maxTries = 10;
      let success = true;
      do {
        try {
          await connMain?.query(dbMan.revokePostgresRoleQuery(user, database));
          success = true;
        } catch (_) {
          success = false;
        }
        maxTries--;
      } while (!success && maxTries);
      maxTries = 10;
      success = true;
      do {
        try {
          await connMain?.query(dbMan.dropPostgresRoleQuery(user, database, false));
        } catch (_) {
          success = false;
        }
        maxTries--;
      } while (!success && maxTries);
      await connMain?.close();
    }, 1);
  }
}

export async function dump(dbId: string, dataOnly: boolean) {
  const dbMeta = await MetadataRepo.getDbById(dbId);
  if (dbMeta?.upgrading) throw new Error('Currently upgrading, cannot dump this database');
  const pgUrl = dbMan.ourPgUrl(dbId);
  // TODO: Drop the old 'aws_account' when v0.0.20 is the oldest version.
  // Also TODO: Automatically figure out which tables to exclude here.
  const excludedDataTables =
    "--exclude-table-data 'aws_account' --exclude-table-data 'aws_credentials' --exclude-table-data 'iasql_*'";
  const { stdout } = await exec(
    `pg_dump ${
      dataOnly
        ? `--data-only --no-privileges --column-inserts --rows-per-insert=50 --on-conflict-do-nothing ${excludedDataTables}`
        : ''
    } --inserts -x ${pgUrl}`,
    { shell: '/bin/bash' },
  );
  return stdout;
}

// TODO revive and test
/*export async function load(
  dumpStr: string,
  dbAlias: string,
  awsRegion: string,
  awsAccessKeyId: string,
  awsSecretAccessKey: string,
  user: any,
) {
  let conn1, conn2, dbId, dbUser;
  try {
    logger.info('Creating account for user...');
    const dbGen = dbMan.genUserAndPass();
    dbUser = dbGen[0];
    const dbPass = dbGen[1];
    const meta = await dbMan.setMetadata(dbAlias, dbUser, user);
    dbId = meta.dbId;
    logger.info('Establishing DB connections...');
    conn1 = await createConnection(dbMan.baseConnConfig);
    await conn1.query(`CREATE DATABASE ${dbId};`);
    conn2 = await createConnection({
      ...dbMan.baseConnConfig,
      name: dbId,
      database: dbId,
    });
    // Restore dump and wrap it in a try catch
    // that drops the database on error
    logger.info('Restoring schema and data from dump...');
    await conn2.query(dumpStr);
    // Update aws_account schema
    await conn2.query(`
      UPDATE public.aws_account
      SET access_key_id = '${awsAccessKeyId}', secret_access_key = '${awsSecretAccessKey}', region = '${awsRegion}'
      WHERE id = 1;
    `);
    // Grant permissions
    await conn2.query(dbMan.newPostgresRoleQuery(dbUser, dbPass, dbId));
    await conn2.query(dbMan.grantPostgresRoleQuery(dbUser));
    logger.info('Done!');
    return {
      alias: dbAlias,
      id: dbId,
      user: dbUser,
      password: dbPass,
    };
  } catch (e: any) {
    // delete db in psql and metadata in IP
    await conn1?.query(`DROP DATABASE IF EXISTS ${dbId} WITH (FORCE);`);
    await conn1?.query(`
      DROP ROLE IF EXISTS ${dbUser};
    `);
    await dbMan.delMetadata(dbAlias, user);
    // rethrow the error
    throw e;
  } finally {
    await conn1?.close();
    await conn2?.close();
  }
}*/
