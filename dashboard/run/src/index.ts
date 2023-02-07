import express from 'express';
import cors from 'cors';
import { Request, Response } from 'express';
import { createLogger } from '@logdna/logger';
import { verify as jwtVerify, decode as jwtDecode, JwtPayload } from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import pg from 'pg';
import { parse, deparse } from 'pgsql-parser';
import { createConnection, Connection } from 'typeorm';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import format from 'pg-format';
import { v4 as uuidv4 } from 'uuid';

import config from './config';
import { throwError } from './config/config';

export function isString(obj: unknown): obj is string {
  return typeof obj === 'string';
}

const logger = !!config.logDna ? createLogger(config.logDna.key, { levels: ['info', 'warn', 'error'], }) : console;
(logger as any)?.on?.('error', (event: any) => {
  if (event.retrying) return;
  console.log('Fatal error in LogDNA');
});

const port = config.http.port;
const app = express();

app.use(cors({ origin: config.http.corsOrigin, }));
app.use(express.json({ limit: '10000MB' }));
app.use(express.text({ limit: '10000MB' }));

app.get('/health', (_req: Request, res: Response) => res.end('OK'));

// Special user for lambda with access to iasql_metadata
export const baseConnConfig: PostgresConnectionOptions = {
  name: 'base', // If you use multiple connections they must have unique names or typeorm bails
  type: 'postgres',
  username: config.db.user,
  password: config.db.password,
  host: config.db.host,
  database: 'iasql_metadata',
  extra: {
    ssl: { rejectUnauthorized: false },
  }, // TODO: remove once DB instance with custom ssl cert is in place
};

function extractTokenFromHeader(e: Request) {
  if (Object.keys(e.headers ?? {})?.length && e.headers.authorization?.split(' ')[0] === 'Bearer') {
    return e.headers.authorization?.split(' ')[1];
  } else {
    return undefined;
  }
}

async function validateToken(token: string): Promise<JwtPayload> {
  if (!config.auth) return {};
  const jwkClient = new jwksRsa.JwksClient({ jwksUri: `${config.auth?.domain}.well-known/jwks.json` });
  const verificationOptions = {
    audience: config.auth?.audience,
    issuer: config.auth?.domain,
    algorithm: 'RS256',
  };

  const tokenHeader = jwtDecode(token, { complete: true })?.header;
  if (!tokenHeader) throw new Error('Invalid token');
  const pubKey = (await jwkClient.getSigningKey(tokenHeader.kid)).getPublicKey();
  if (!pubKey) throw new Error('No key in header');
  const decoded = jwtVerify(token, pubKey, verificationOptions);
  return decoded as JwtPayload;
}

const dbConns: { [key: string]: Connection } = {};

async function metaQuery(sql: string, params?: any[]): Promise<any> {
  const db = 'iasql_metadata';
  if (!dbConns[db]?.isConnected) {
    // Trash this object and rebuild it
    delete dbConns[db];
    dbConns[db] = await createConnection({ ...baseConnConfig, name: db, database: db });
  }
  const dbConn = dbConns[db];
  const out = await dbConn.query(sql, params);
  return out;
}

async function runSql(sql: string, dbAlias: string, username: string, password: string) {
  const dbId = await (async () => {
    if (dbAlias === 'iasql_metadata') return dbAlias;
    const res = await metaQuery(`
      SELECT pg_name
      FROM iasql_database id
      INNER JOIN iasql_user_databases iud ON id.pg_name = iud.iasql_database_pg_name
      WHERE iud.iasql_user_id = $1 AND id.alias = $2;
    `, [username, dbAlias]);
    const dbId = res?.[0]?.pg_name ?? throwError(`dbAlias ${dbAlias} not found`);
    return dbId;
  })();
  const out: any = [];
  let connTemp;
  const stmts = parse(sql);
  for (const stmt of stmts) {
    connTemp = new pg.Client({
      database: dbId,
      user: username,
      password,
      host: baseConnConfig.host,
      ssl: baseConnConfig.extra.ssl,
    });
    await connTemp.connect();
    // await connTemp.query(dbMan.setPostgresRoleQuery(database));
    const deparsedStmt = deparse(stmt);
    try {
      const queryRes = await connTemp.query(deparsedStmt);
      out.push({
        statement: deparsedStmt,
        queryRes,
      });
    } catch (e) {
      throw e;
    } finally {
      await connTemp?.end();
    }
  }
  // Let's make this a bit easier to parse. Error -> error path, single table -> array of objects,
  // multiple tables -> array of array of objects
  return out.map((t: any) => {
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
  });
}

const lowerCharset = Array(26)
  .fill('a')
  .map((c, i) => String.fromCharCode(c.charCodeAt() + i));
const upperCharset = Array(26)
  .fill('A')
  .map((c, i) => String.fromCharCode(c.charCodeAt() + i));
const numberCharset = Array(10)
  .fill('0')
  .map((c, i) => String.fromCharCode(c.charCodeAt() + i));
const passwordCharset = [...lowerCharset, ...upperCharset, ...numberCharset, ...'.^*'.split('')];
const randChar = (a: string[]): string => a[Math.floor(Math.random() * a.length)];

async function getUserAndPassword(
  tokenInfo: JwtPayload,
  dbAlias: string,
): Promise<{ username: string; password: string }> {
  let username;
  if (config.auth) {
    username = tokenInfo.sub ?? throwError('No username found on auth token');
  } else {
    const res = await metaQuery(`
      SELECT id
      FROM iasql_user
      LIMIT 1;
    `);
    username = res?.[0]?.id ?? uuidv4().split('-').join('');
  }
  const email = tokenInfo[`${config.auth?.domain}email`] ?? 'hello@iasql.com';
  const password = Array(16)
    .fill('')
    .map(() => randChar(passwordCharset))
    .join('');
  await metaQuery(`
    DO $$ 
      BEGIN 
        IF EXISTS (
          SELECT FROM pg_catalog.pg_roles
          WHERE rolname = '${username}') THEN
          ${format('ALTER ROLE %I WITH PASSWORD %L;', username, password)}
        ELSE
          ${format('CREATE ROLE %I LOGIN PASSWORD %L;', username, password)}
          ${format('INSERT INTO iasql_user (id, email) VALUES (%L, %L);', username, email)}
        END IF;
      END;
    $$;
  `);
  if (dbAlias !== 'iasql_metadata') {
    const res = await metaQuery(`
      SELECT pg_name
      FROM iasql_database id
      INNER JOIN iasql_user_databases iud ON id.pg_name = iud.iasql_database_pg_name
      WHERE iud.iasql_user_id = $1 AND id.alias = $2;
    `, [username, dbAlias]);
    const dbId = res?.[0]?.pg_name ?? throwError(`dbAlias ${dbAlias} not found`);
    // Apparently GRANT and REVOKE can run into concurrency issues in Postgres. Serializing it would
    // be best, but https://www.postgresql.org/message-id/3473.1393693757%40sss.pgh.pa.us says that
    // just retrying ought to work. Doing this in a simple do-while loop with a counter to abort if
    // too many attempts occur.
    let maxTries = 10;
    let success = true;
    do {
      try {
        await metaQuery(`
          GRANT $1 TO $2;
        `, [`group_role_${dbId}`, username]);
        success = true;
      } catch (_) {
        success = false;
      }
      maxTries--;
    } while (!success && maxTries);
  }
  return { username, password };
}

function until<T>(p: Promise<T>, timeout: number): Promise<T> {
  return new Promise((resolve, reject) => {
    let finished: boolean = false;
    p.then((val: any) => {
      if (!finished) {
        finished = true;
        resolve(val);
      }
    }).catch((err: any) => {
      if (!finished) {
        finished = true;
        reject(err);
      }
    });
    setTimeout(() => {
      if (!finished) {
        finished = true;
        reject(new Error(`Timeout of ${timeout}ms reached`));
      }
    }, timeout);
  });
}

app.post('/', async (req: Request, res: Response) => {
  logger.log('Handling request', {
    level: 'info',
    app: 'run',
    env: process.env.IASQL_ENV,
    meta: req.body
  });
  const execTime = 15 * 60 * 1000; // 15 minutes ought to be enough for anyone ;)
  const t1 = Date.now();
  try {
    const output = await until(
      (async () => {
        let token: string = extractTokenFromHeader(req) || '';
        const tokenInfo = await validateToken(token);
        const { dbAlias, sql } = req.body;
        const { username, password } = await getUserAndPassword(tokenInfo, dbAlias);
        const out = await runSql(sql, dbAlias, username, password);
        return out;
      })(),
      execTime - 100,
    );
    const t2 = Date.now();
    logger.log(`Total runtime took ${t2 - t1}`, {
      level: 'info',
      app: 'run',
      meta: {
        t2,
        t1,
      },
      env: process.env.IASQL_ENV,
    });
    return res.status(200).json(output);
  } catch (e: any) {
    return res.status(401).json({ message: e?.message ?? 'Unknown error', });
  }
});

app.listen(port);
logger.log(`Listening on port ${port}`, {
  level: 'info',
  app: 'run',
  env: process.env.IASQL_ENV,
});
process.on('uncaughtException', (event) => {
  logger.log('Uncaught exception', {
    level: 'error',
    app: 'run',
    meta: {
      event,
    },
    env: process.env.IASQL_ENV,
  });
  process.exit(1);
});
