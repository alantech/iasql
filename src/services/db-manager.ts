import { randomBytes } from 'crypto';
import format from 'pg-format';
import { Connection } from 'typeorm';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

import config from '../config';
import * as Modules from '../modules';

export async function migrate(conn: Connection) {
  // Needs to be done this way or a redeploy would accidentally start using the next version even
  // if it is not yet enabled.
  const iasqlPlatform = Modules.iasqlPlatform;
  const version = iasqlPlatform.version;
  const qr = conn.createQueryRunner();
  await qr.connect();
  await iasqlPlatform.migrations.beforeInstall?.(qr);
  await iasqlPlatform.migrations.install(qr);
  await iasqlPlatform.migrations.afterInstall?.(qr);
  await qr.query(`INSERT INTO iasql_module
                  VALUES ('iasql_platform@${version}')`);
  await Modules.iasqlFunctions.migrations.beforeInstall?.(qr);
  await Modules.iasqlFunctions.migrations.install(qr);
  await Modules.iasqlFunctions.migrations.afterInstall?.(qr);
  await qr.query(`INSERT INTO iasql_module
                  VALUES ('iasql_functions@${version}')`);
  await qr.query(
    `INSERT INTO iasql_dependencies
     VALUES ('iasql_functions@${version}', 'iasql_platform@${version}')`,
  );
  await qr.query(`INSERT INTO iasql_tables ("table", "module") VALUES
    ${iasqlPlatform.provides.tables.map(tbl => `('${tbl}', 'iasql_platform@${version}')`).join(', ')};
  `);
  await qr.release();
}

function randomHexValue() {
  return randomBytes(8).toString('hex').toLowerCase();
}

export function genDbId(dbAlias: string) {
  return config.db.multiUser ? `_${randomHexValue()}` : dbAlias;
}

function getGroupRole(dbId: string) {
  return `group_role_${dbId}`;
}

export const baseConnConfig: PostgresConnectionOptions = {
  name: 'base', // If you use multiple connections they must have unique names or typeorm bails
  type: 'postgres',
  username: config.db.user,
  password: config.db.password,
  host: config.db.host,
  database: 'postgres',
  extra: {
    ssl: ['postgresql', 'localhost'].includes(config.db.host) ? false : { rejectUnauthorized: false },
  }, // TODO: remove once DB instance with custom ssl cert is in place
};

// TODO: try to roll back the `GRANT CREATE` to something a bit narrower in the future
export function newPostgresRoleQuery(user: string, pass: string, dbId: string) {
  return format(
    `
    CREATE ROLE %I LOGIN PASSWORD %L;
    GRANT CONNECT ON DATABASE %I TO %I;
    GRANT CREATE ON SCHEMA public TO %I;
  `,
    user,
    pass,
    dbId,
    user,
    user,
  );
}

export function createDbPostgreGroupRole(dbId: string) {
  // Taken from https://stackoverflow.com/a/55954480
  return format(
    `
    DO $$
    BEGIN
    CREATE ROLE %I;
    EXCEPTION WHEN duplicate_object THEN RAISE NOTICE '%, skipping', SQLERRM USING ERRCODE = SQLSTATE;
    END
    $$;
  `,
    getGroupRole(dbId),
  );
}

export function grantPostgresGroupRoleToUser(user: string, dbId: string) {
  const groupRole = getGroupRole(dbId);
  return format(
    `
    GRANT %I to %I;
  `,
    groupRole,
    user,
  );
}

// runs query using the group role so user generated tables have the same owner
export function setPostgresRoleQuery(dbId: string) {
  return format(
    `
    SET ROLE %I;
  `,
    getGroupRole(dbId),
  );
}

export function revokePostgresRoleQuery(user: string, dbId: string) {
  return format(
    `
    REVOKE %I FROM %I;
  `,
    getGroupRole(dbId),
    user,
  );
}

export function dropPostgresRoleQuery(user: string, dbId: string, dropGroupRole: boolean) {
  if (dropGroupRole)
    return format(`DROP ROLE IF EXISTS %I; DROP ROLE IF EXISTS %I;`, user, getGroupRole(dbId));
  return format(`DROP ROLE IF EXISTS %I;`, user);
}

// Create a randomly generated username and password, an 8 char username [a-z][a-z0-9]{7} and a
// 16 char password [a-zA-Z0-9!@$%^*]{16}
export function genUserAndPass(): [string, string] {
  const userFirstCharCharset = [
    Array(26)
      .fill('a')
      .map((c, i) => String.fromCharCode(c.charCodeAt() + i)),
  ].flat();
  const userRestCharCharset = [
    ...userFirstCharCharset,
    Array(10)
      .fill('0')
      .map((c, i) => String.fromCharCode(c.charCodeAt() + i)),
  ].flat();
  const passwordCharset = [
    ...userRestCharCharset,
    Array(26)
      .fill('A')
      .map((c, i) => String.fromCharCode(c.charCodeAt() + i)),
    '$.^*'.split(''),
  ].flat();
  const randChar = (a: string[]): string => a[Math.floor(Math.random() * a.length)];
  const user = [
    randChar(userFirstCharCharset),
    Array(7)
      .fill('')
      .map(() => randChar(userRestCharCharset)),
  ]
    .flat()
    .join('');
  const pass = Array(16)
    .fill('')
    .map(() => randChar(passwordCharset))
    .join('');
  return [user, pass];
}

export function setUpDblink(dbId: string) {
  return format(
    `
    CREATE EXTENSION IF NOT EXISTS dblink;
    CREATE SERVER IF NOT EXISTS %I FOREIGN DATA WRAPPER dblink_fdw OPTIONS (host %L, dbname 'iasql_metadata', port %L);
    CREATE USER MAPPING IF NOT EXISTS FOR %I SERVER %I OPTIONS (user %L, password %L);
  `,
    `cron_dblink_${dbId}`,
    config.db.host,
    config.db.port,
    config.db.user,
    `cron_dblink_${dbId}`,
    config.db.user,
    config.db.password,
  );
}
