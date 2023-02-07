// TODO: It seems like a lot of this logic could be migrated into the iasql_platform module and make
// sense there. Need to think a bit more on that, but module manipulation that way could allow for
// meta operations within the module code itself, if desirable.
import { exec as execNode } from 'child_process';
import fetch from 'node-fetch';
import { Connection } from 'typeorm';
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
export async function connect(
  dbAlias: string,
  uid: string,
  email: string,
  dbId = dbMan.genDbId(dbAlias),
  dbPregen?: string[],
) {
  let conn1: any, conn2: any, dbUser: any;
  let dbSaved,
    roleGranted = false;
  try {
    logger.info('Creating account for user...');
    const dbGen = dbPregen ?? dbMan.genUserAndPass();
    dbUser = dbGen[0];
    const dbPass = dbGen[1];
    const metaDb = new IasqlDatabase();
    metaDb.alias = dbAlias;
    metaDb.pgUser = dbUser;
    metaDb.pgName = dbId;
    if (!dbPregen) await MetadataRepo.saveDb(uid, email, metaDb);
    dbSaved = true;
    logger.info('Establishing DB connections...');
    conn1 = await new Connection(dbMan.baseConnConfig).connect();
    await conn1.query(`
      CREATE DATABASE "${dbId}";
    `);
    conn2 = await new Connection({
      ...dbMan.baseConnConfig,
      name: dbId,
      database: dbId,
    }).connect();
    await dbMan.migrate(conn2);
    await conn2.query('CREATE SCHEMA http; CREATE EXTENSION http WITH SCHEMA http;');
    await conn2.query(dbMan.setUpDblink(dbId));
    await conn2.query(`SELECT * FROM query_cron('schedule');`);
    await conn2.query(`SELECT * FROM query_cron('schedule_purge');`);
    await conn2.query(dbMan.createDbPostgreGroupRole(dbId));
    if (dbPass) await conn2.query(dbMan.newPostgresRoleQuery(dbUser, dbPass, dbId));
    await conn2.query(dbMan.grantPostgresGroupRoleToUser(dbUser, dbId));
    roleGranted = true;
    const recCount = await getDbRecCount(conn2);
    if (!dbPregen) await MetadataRepo.updateRecordCount(dbId, recCount);
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
    if (dbSaved) await conn1?.query(`DROP DATABASE IF EXISTS "${dbId}" WITH (FORCE);`);
    if (dbUser && roleGranted) await conn1?.query(dbMan.dropPostgresRoleQuery(dbUser, dbId, true));
    if (dbSaved && !dbPregen) await MetadataRepo.delDb(uid, dbAlias);
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
    conn = await new Connection(dbMan.baseConnConfig).connect();
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
  logger.info('Starting upgrade...');
  const dbs = await MetadataRepo.getAllDbs();
  const dbsDone: { [key: string]: boolean } = {};
  for (const db of dbs) {
    logger.info(`Starting Part 2 of 3 for ${db.pgName}`);
    const user = await MetadataRepo.getUserFromDbId(db.pgName);
    // If there's no user for this database, there's something corrupt and we should log and skip
    if (!user) {
      logger.warn('IaSQL database without a user', { db });
      continue;
    }
    // The actual database is sitting at OLD_<db> so we connect to the database and extract the
    // data we need to migrate over
    const conn = await new Connection({
      ...dbMan.baseConnConfig,
      name: `OLD${db.pgName}`,
      database: `OLD${db.pgName}`,
    }).connect();
    // Every IaSQL database has an audit log, so let's retrieve the current log for future use
    const auditLogLines =
      (
        await conn.query(`
      SELECT array_to_json(ARRAY(SELECT row_to_json(iasql_audit_log) FROM iasql_audit_log));
    `)
      )?.[0]?.array_to_json ?? [];
    // Get the list of modules in the database that we will have to re-install
    const moduleList = (
      await conn.query(`
      SELECT split_part(name, '@', 1) AS module FROM iasql_module;
    `)
    ).map((r: { module: string }) => r.module);
    // If the 'aws_account' module is installed, we need to acquire the credentials and region
    // configuration
    let creds: { [key: string]: string }, regionsEnabled: { region: string }[], defaultRegion: string;
    if (moduleList.includes('aws_account')) {
      creds =
        (
          await conn.query(`
        SELECT * FROM aws_credentials;
      `)
        )?.[0] ?? undefined;
      regionsEnabled = await conn.query(`
        SELECT region FROM aws_regions WHERE is_enabled = TRUE;
      `);
      defaultRegion =
        (
          await conn.query(`
        SELECT region FROM aws_regions WHERE is_default = TRUE;
      `)
        )?.[0]?.region ?? 'us-east-1';
    }
    // If there was a failure after `NEW_<db>` was created, we should delete the existing one
    // and do this again. We'll use the OLD db connection to test
    const hasNewDb =
      (await conn.query(`SELECT datname FROM pg_database WHERE datname = 'NEW${db.pgName}'`))?.[0]?.datname ??
      '' === `NEW${db.pgName}`;
    if (hasNewDb) {
      await conn.query(`DROP DATABASE "NEW${db.pgName}"`);
    }
    // Close out the connection to the old version of the DB
    await conn.close();
    // We need to create a new database called `NEW_<db>` with the current DB user associated
    await connect(`NEW${db.alias}`, user.id, user.email, `NEW${db.pgName}`, [db.pgUser]);
    // Create a new conn for the new DB
    const newConn = await new Connection({
      ...dbMan.baseConnConfig,
      name: `NEW${db.pgName}`,
      database: `NEW${db.pgName}`,
    }).connect();
    // Next re-insert the audit log
    try {
      // It's slower, but safer to insert these records one at a time
      for (const line of auditLogLines) {
        await newConn.query(
          `
          INSERT INTO iasql_audit_log (ts, "user", table_name, change_type, change, message) VALUES
          ($1, $2, $3, $4, $5, $6);
        `,
          [line.ts, line.user, line.table_name, line.change_type, line.change, line.message],
        );
      }
    } catch (e: any) {
      logger.warn(`Failed to load the audit log: ${e.message}`, { e });
    }
    logger.info(`Part 2 of 3 for ${db.pgName} complete!`);
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
      logger.info(`Starting Part 3 of 3 for ${db.pgName}`);
      upgradeRunning = true;
      if (!!creds) {
        try {
          await newConn.query(`
            SELECT iasql_install('aws_account');
          `);
        } catch (e) {
          logger.warn('Failed to install aws_account', { e });
        }
        try {
          await newConn.query(`
            SELECT iasql_begin();
          `);
        } catch (e) {
          logger.warn('Failed to begin an IaSQL transaction?', { e });
        }
        try {
          await newConn.query(
            `
            INSERT INTO aws_credentials (access_key_id, secret_access_key) VALUES
            ($1, $2);
          `,
            [creds.access_key_id, creds.secret_access_key],
          );
        } catch (e) {
          logger.warn('Failed to insert credentials', { e });
        }
        try {
          await newConn.query(`
            SELECT iasql_commit();
          `);
        } catch (e) {
          logger.warn('Failed to commit the transaction', { e });
        }
        logger.info('Regions Enabled', { regionsEnabled });
        for (const region of regionsEnabled) {
          try {
            await newConn.query(
              `
              UPDATE aws_regions SET is_enabled = TRUE WHERE region = $1;
            `,
              [region.region],
            );
          } catch (e) {
            logger.warn('Failed to enable an aws_region', { e, region });
          }
        }
        try {
          await newConn.query(
            `
            UPDATE aws_regions SET is_default = TRUE WHERE region = $1;
          `,
            [defaultRegion],
          );
        } catch (e) {
          logger.warn('Failed to set the default region', { e, defaultRegion });
        }
      }
      for (const mod of moduleList) {
        try {
          await newConn.query(
            `
            SELECT iasql_install($1);
          `,
            [mod],
          );
        } catch (e) {
          logger.warn('Failed to install a module on upgrade', { e, mod });
        }
      }
      dbsDone[db.pgName] = true;
      await newConn.close();
      // Create a final connection to rename `NEW_<db>` to `<db>` and drop `OLD_<db>`
      const lastConn = await new Connection({
        ...dbMan.baseConnConfig,
        name: `CLEAN${db.pgName}`,
        database: 'iasql_metadata',
      }).connect();
      // Make sure nothing is connected to the new database when we rename it or the old when we drop it
      await lastConn.query(`
        SELECT pg_terminate_backend( pid )
        FROM pg_stat_activity
        WHERE pid <> pg_backend_pid( )
            AND (datname = 'NEW${db.pgName}' OR datname = 'OLD${db.pgName}');
      `);
      await lastConn.query(`
        ALTER DATABASE "NEW${db.pgName}" RENAME TO "${db.pgName}";
      `);
      await lastConn.query(`
        DROP DATABASE "OLD${db.pgName}";
      `);
      clearInterval(upgradeHandle);
      logger.info(`Part 3 of 3 for ${db} complete!`);
      if (
        Object.keys(dbsDone).sort().join(',') ===
        dbs
          .map(someDb => someDb.pgName)
          .sort()
          .join(',')
      ) {
        logger.info('Upgrade complete');
      }
    }, 15000);
  }
}
