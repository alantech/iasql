// TODO: It seems like a lot of this logic could be migrated into the iasql_platform module and make
// sense there. Need to think a bit more on that, but module manipulation that way could allow for
// meta operations within the module code itself, if desirable.
import { exec as execNode } from 'child_process';
import { createConnection } from 'typeorm';
import { promisify } from 'util';

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
    try {
      // If commit is running we should try to wait until it finish to avoid misconfigurations in the cloud
      // but it is not a blocker to disconnect
      const commitRunning = await isCommitRunning(conn2);
      if (commitRunning) {
        await maybeOpenTransaction(conn2);
      }
      await conn2.query(`SELECT * FROM query_cron('unschedule');`);
      await conn2.query(`SELECT * FROM query_cron('unschedule_purge');`);
    } catch (_) {
      /** Do nothing */
    }
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
