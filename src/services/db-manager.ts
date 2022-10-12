import { randomBytes } from 'crypto';
import { Connection } from 'typeorm';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

import config from '../config';
import { throwError } from '../config/config';
import { modules as Modules } from '../modules';

const queryUserGroupRole = 'query_table_access_group';

export async function migrate(conn: Connection) {
  // Needs to be done this way or a redeploy would accidentally start using the next version even
  // if it is not yet enabled.
  const ModuleSet = (Modules as any)[config.modules.latestVersion];
  const iasqlPlatform = ModuleSet?.iasqlPlatform ?? throwError('Core IasqlPlatform not found');
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
  if (ModuleSet?.iasqlFunctions?.migrations?.beforeInstall) {
    await ModuleSet?.iasqlFunctions?.migrations?.beforeInstall(qr);
  }
  await ModuleSet?.iasqlFunctions?.migrations?.install(qr);
  if (ModuleSet?.iasqlFunctions?.migrations?.afterInstall) {
    await ModuleSet?.iasqlFunctions?.migrations?.afterInstall(qr);
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
    GRANT CONNECT ON DATABASE ${dbId} TO ${user};
    GRANT CREATE ON SCHEMA public TO ${user};
  `;
}

export function createQueryGroupRole() {
  return `
    CREATE ROLE ${queryUserGroupRole};
  `;
}

export function grantPostgresRoleQuery(user: string) {
  return `
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${queryUserGroupRole};
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${queryUserGroupRole};
    GRANT EXECUTE ON ALL PROCEDURES IN SCHEMA public TO ${queryUserGroupRole};
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${queryUserGroupRole};
    GRANT ${queryUserGroupRole} to ${user};
  `;
}

export function setPostgresRoleQuery() {
  return `
    SET ROLE ${queryUserGroupRole};
  `;
}

export function revokePostgresRoleQuery(user: string, dbId: string) {
  return `
    REVOKE ${queryUserGroupRole} FROM ${user};
  `;
}

export function dropPostgresRoleQuery(user: string) {
  return `
    DROP ROLE IF EXISTS ${user};
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

export function getEmail(user: any): string {
  // following the format for this auth0 rule
  // https://manage.auth0.com/dashboard/us/iasql/rules/rul_D2HobGBMtSmwUNQm
  // more context here https://community.auth0.com/t/include-email-in-jwt/39778/4
  return config.auth ? user[`${config.auth.domain}email`] : 'hello@iasql.com';
}

// TODO type user
export function getUid(user: any): string {
  return config.auth ? user.sub : 'iasql';
}
