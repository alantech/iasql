// TODO: It seems like a lot of this logic could be migrated into the iasql_platform module and make
// sense there. Need to think a bit more on that, but module manipulation that way could allow for
// meta operations within the module code itself, if desirable.
import { exec as execNode, execSync } from 'child_process';
import { existsSync, readdirSync, readFileSync } from 'fs';
import fetch from 'node-fetch';
import { createConnection } from 'typeorm';
import { promisify } from 'util';

import config from '../config';
import { IasqlDatabase } from '../entity';
import { isCommitRunning, maybeOpenTransaction } from '../modules/iasql_functions/iasql';
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
    await MetadataRepo.updateRecordCount(dbId, recCount);
    logger.info('Done!');
    // Return custom IasqlDatabase object since we need to return the password
    return {
      user: dbUser,
      password: dbPass,
      recordCount: recCount,
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
  let conn, conn2;
  try {
    const db: IasqlDatabase = await MetadataRepo.getDb(uid, dbAlias);
    conn = await createConnection(dbMan.baseConnConfig);
    conn2 = await TypeormWrapper.createConn(db.pgName, {
      ...dbMan.baseConnConfig,
      database: db.pgName,
    });
    // Try to hold a transaction
    await maybeHoldTransaction(conn2);
    // Unschedule cron jobs
    await unscheduleJobs(conn2);
    // Cancel all connections
    await conn.query(`REVOKE CONNECT ON DATABASE ${db.pgName} FROM PUBLIC, ${config.db.user}, ${db.pgUser};`);
    // Kill all open connections.
    // `pg_terminate_backend` forces any currently running transactions in the terminated session to release all locks and roll back the transaction.
    // `pg_cancel_backend` cancels a query currently being run.
    // https://stackoverflow.com/questions/5108876/kill-a-postgresql-session-connection
    await conn.query(`
      SELECT
        pg_terminate_backend(pid), pg_cancel_backend(pid)
      FROM
        pg_stat_activity
      WHERE
        -- don't kill my own connection!
        pid <> pg_backend_pid()
        -- don't kill the connections to other databases
        AND datname = '${db.pgName}';
    `);
    await conn.query(`
      DROP DATABASE IF EXISTS ${db.pgName} WITH (FORCE);
    `);
    await conn.query(dbMan.dropPostgresRoleQuery(db.pgUser, db.pgName, true));
    await MetadataRepo.delDb(uid, dbAlias);
    return db.pgName;
  } catch (e: any) {
    // re-throw
    throw e;
  } finally {
    conn?.close();
    conn2?.dropConn();
  }
}

async function maybeHoldTransaction(conn: TypeormWrapper) {
  try {
    // If commit is running we should try to wait until it finish to avoid misconfigurations in the cloud
    // but it is not a blocker
    const commitRunning = await isCommitRunning(conn);
    if (commitRunning) {
      await maybeOpenTransaction(conn);
    }
  } catch (_) {
    /** Do nothing */
  }
}

async function unscheduleJobs(conn: TypeormWrapper) {
  try {
    await conn.query(`SELECT * FROM query_cron('unschedule');`);
    await conn.query(`SELECT * FROM query_cron('unschedule_purge');`);
  } catch (_) {
    /** Do nothing */
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

export async function upgrade() {
  const dbs = readdirSync('/tmp/upgrade');
  const dbsDone: { [key: string]: boolean } = {};
  for (const db of dbs) {
    logger.info(`Starting Part 2 of 3 for ${db}`);
    // Connect to the database and first re-insert the baseline modules
    const conn = await createConnection({
      ...dbMan.baseConnConfig,
      name: db,
      database: db,
    });
    await dbMan.migrate(conn);
    // Next re-insert the audit log
    try {
      const auditLogLines = JSON.parse(readFileSync(`/tmp/upgrade/${db}/audit_log`, 'utf8'));
      // It's slower, but safer to insert these records one at a time
      for (const line of auditLogLines) {
        await conn.query(
          `
          INSERT INTO iasql_audit_log (ts, "user", table_name, change_type, change, message) VALUES
          ($1, $2, $3, $4, $5, $6);
        `,
          [line.ts, line.user, line.table_name, line.change_type, line.change, line.message],
        );
      }
    } catch (e: any) {
      logger.warn(`Failed to load the audit log: ${e.message}`, { e, });
    }
    logger.info(`Part 2 of 3 for ${db} complete!`);
    // Restoring the `aws_account` and other modules requires the engine to be fully started
    // We can't do that immediately, but we *can* create a polling job to do it as soon as the
    // engine has finished starting
    let upgradeRunning = false;
    const upgradeHandle = setInterval(async () => {
      let started = false;
      try {
        started = (await (await fetch(`http://localhost:${config.http.port}/health`)).text()) === 'ok';
      } catch (_) {
        // We don't care if it fails to fetch, just a timing issue in starting the rest of the engine
      }
      if (!started || upgradeRunning) return;
      logger.info(`Starting Part 3 of 3 for ${db}`);
      upgradeRunning = true;
      const hasCreds = existsSync(`/tmp/upgrade/${db}/creds`);
      if (hasCreds) {
        // Assuming the other two also exist
        const creds = readFileSync(`/tmp/upgrade/${db}/creds`, 'utf8').trim().split(',');
        const regionsEnabled = readFileSync(`/tmp/upgrade/${db}/regions_enabled`, 'utf8').trim().split(' ');
        const defaultRegion = readFileSync(`/tmp/upgrade/${db}/default_region`, 'utf8').trim();
        await conn.query(`
          SELECT iasql_install('aws_account');
        `);
        await conn.query(`
          SELECT iasql_begin();
        `);
        logger.info('Temporarily log the creds to see what is going on', { creds });
        await conn.query(
          `
          INSERT INTO aws_credentials (access_key_id, secret_access_key) VALUES
          ($1, $2);
        `,
          creds,
        );
        await conn.query(`
          SELECT iasql_commit();
        `);
        logger.info('Regions Enabled', { regionsEnabled });
        for (const region of regionsEnabled) {
          await conn.query(
            `
            UPDATE aws_regions SET is_enabled = TRUE WHERE region = $1;
          `,
            [region],
          );
        }
        await conn.query(
          `
          UPDATE aws_regions SET is_default = TRUE WHERE region = $1;
        `,
          [defaultRegion],
        );
      }
      const moduleList = readFileSync(`/tmp/upgrade/${db}/module_list`, 'utf8').trim().split(' ');
      logger.info('Module List', { moduleList });
      for (const mod of moduleList) {
        await conn.query(
          `
          SELECT iasql_install($1);
        `,
          [mod],
        );
      }
      execSync(`rm -rf /tmp/upgrade/${db}`);
      dbsDone[db] = true;
      clearInterval(upgradeHandle);
      logger.info(`Part 3 of 3 for ${db} complete!`);
      if (Object.keys(dbsDone).sort().join(',') === dbs.sort().join(',')) {
        logger.info('Final cleanup of upgrade');
        execSync('rm -rf /tmp/upgrade');
        logger.info('Upgrade complete');
      }
    }, 15000);
  }
}
