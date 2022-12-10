import { randomBytes } from 'crypto';
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
  if (iasqlPlatform.migrations?.beforeInstall) {
    await iasqlPlatform.migrations.beforeInstall(qr);
  }
  await iasqlPlatform.migrations.install(qr);
  if (iasqlPlatform.migrations.afterInstall) {
    await iasqlPlatform.migrations.afterInstall(qr);
  }
  await qr.query(`INSERT INTO iasql_module VALUES ('iasql_platform@${version}')`);
  if (Modules.iasqlFunctions?.migrations?.beforeInstall) {
    await Modules.iasqlFunctions?.migrations?.beforeInstall(qr);
  }
  await Modules.iasqlFunctions?.migrations?.install(qr);
  if (Modules.iasqlFunctions?.migrations?.afterInstall) {
    await Modules.iasqlFunctions?.migrations?.afterInstall(qr);
  }
  await qr.query(`INSERT INTO iasql_module VALUES ('iasql_functions@${version}')`);
  await qr.query(
    `INSERT INTO iasql_dependencies VALUES ('iasql_functions@${version}', 'iasql_platform@${version}')`,
  );
  await qr.release();
}

function randomHexValue() {
  return randomBytes(8).toString('hex').toLowerCase();
}

export function genDbId(dbAlias: string) {
  return config.auth ? `_${randomHexValue()}` : dbAlias;
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
  return `
    CREATE ROLE ${user} LOGIN PASSWORD '${pass}';
    GRANT CONNECT ON DATABASE ${dbId} TO "${user}";
    GRANT CREATE ON SCHEMA public TO "${user}";
  `;
}

export function createDbPostgreGroupRole(dbId: string) {
  // Taken from https://stackoverflow.com/a/55954480
  return `
    DO $$
    BEGIN
    CREATE ROLE ${getGroupRole(dbId)};
    EXCEPTION WHEN duplicate_object THEN RAISE NOTICE '%, skipping', SQLERRM USING ERRCODE = SQLSTATE;
    END
    $$;
  `;
}

export function grantPostgresGroupRoleQuery(user: string, dbId: string) {
  const groupRole = getGroupRole(dbId);
  return `
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${groupRole};
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${groupRole};
    GRANT EXECUTE ON ALL PROCEDURES IN SCHEMA public TO ${groupRole};
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${groupRole};
    GRANT ${groupRole} to "${user}";
  `;
}

// runs query using the group role so user generated tables have the same owner
export function setPostgresRoleQuery(dbId: string) {
  return `
    SET ROLE ${getGroupRole(dbId)};
  `;
}

export function revokePostgresRoleQuery(user: string, dbId: string) {
  return `
    REVOKE ${getGroupRole(dbId)} FROM ${user};
  `;
}

export function dropPostgresRoleQuery(user: string, dbId: string, dropGroupRole: boolean) {
  return `
    DROP ROLE IF EXISTS ${user};
    ${dropGroupRole ? `DROP ROLE IF EXISTS ${getGroupRole(dbId)};` : ''}
  `;
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

export function ourPgUrl(dbId: string): string {
  // Using the main user and password, not the users' own account here
  return `postgres://${encodeURIComponent(config.db.user)}:${encodeURIComponent(config.db.password)}@${
    config.db.host
  }/${dbId}`;
}

export function setUpDblink(dbId: string) {
  return `
    CREATE EXTENSION IF NOT EXISTS dblink;
    CREATE SERVER IF NOT EXISTS cron_dblink_${dbId} FOREIGN DATA WRAPPER dblink_fdw OPTIONS (host '${config.db.host}', dbname 'iasql_metadata', port '${config.db.port}');
    CREATE USER MAPPING IF NOT EXISTS FOR ${config.db.user} SERVER cron_dblink_${dbId} OPTIONS (user '${config.db.user}', password '${config.db.password}');
  `;
}
