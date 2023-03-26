import * as semver from 'semver';

import { ConfigInterface } from '@/config/config';

import * as Sentry from './sentry';

async function maybeHandleFetchError(response: any) {
  // TODO: What type here?
  if (!response.ok) {
    let message;
    try {
      message = await response.text();
    } catch (e) {
      message = `HTTP error code ${response.status}`;
    }
    try {
      const jsonEncodedError = JSON.parse(message).message;
      if (!!jsonEncodedError) message = jsonEncodedError;
    } catch (_) {
      // Nothing to do here
    }
    throw new Error(`Error: ${message}`);
  }
}

async function redirectIfUnauthorized(response: any) {
  if (response.status === 403) {
    const obj = await response.json();
    console.dir(obj);
    if (obj.paymentLink) window.location.href = obj.paymentLink;
  }
}

async function post(token: string, backendUrl: string, endpoint: string, body: any, raw = false) {
  const resp = await fetch(`${backendUrl}/${endpoint}`, {
    method: 'POST',
    body: raw ? body : JSON.stringify(body),
    headers: {
      'Content-Type': raw ? 'text/plain' : 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  await redirectIfUnauthorized(resp);
  await maybeHandleFetchError(resp);
  return resp;
}

export async function newDb(token: string, backendUrl: string, dbAlias: string) {
  return (await run(token, backendUrl, 'iasql_metadata', `SELECT * FROM iasql_connect('${dbAlias}');`))?.[0]
    ?.result?.[0];
}

export async function list(token: string, backendUrl: string, config: ConfigInterface) {
  let dbs = [];
  const getDbs = async (tk: string) => {
    try {
      dbs = (
        await run(
          token,
          backendUrl,
          'iasql_metadata',
          `
            SELECT pg_name as "pgName", alias, record_count as "recordCount", upgrading, created_at as "createdAt", updated_at as "updatedAt", pg_user as "pgUser"
            FROM iasql_db_list();
          `,
        )
      )?.[0]?.result;
    } catch (e: any) {
      dbs = [];
      throw new Error(e.message ? e.message : `Unexpected error listing databases`);
    }
    for (const db of dbs) {
      if (!db.upgrading) {
        try {
          // TODO: Abstract this out to a function when other clouds are supported
          const dbAlias = db.alias;
          const results = (
            await run(
              tk,
              backendUrl,
              dbAlias,
              `
            SELECT * FROM iasql_modules_installed();
          `,
            )
          )?.[0]?.result;
          const mods = results?.map((m: any) => m.module_name);
          const version = results?.[0].module_version.split('-')[0];
          const hasAwsAccount = !!(
            await run(
              tk,
              backendUrl,
              dbAlias,
              `
            SELECT * FROM iasql_module WHERE name = 'aws_account@${version}';
          `,
            )
          )?.[0]?.result;
          if (!semver.valid(version)) {
            db.version = 'Unknown';
            db.region = 'Unknown';
            db.isReady = false;
          } else if (semver.lt(version, '0.0.19')) {
            const { access_key_id, secret_access_key, region } = hasAwsAccount
              ? (
                  await run(
                    tk,
                    backendUrl,
                    dbAlias,
                    `
                SELECT * FROM aws_account
              `,
                  )
                )?.[0]?.result?.[0]
              : { access_key_id: undefined, secret_access_key: undefined, region: 'No creds' };
            db.version = version;
            db.region = region;
            db.isReady = !!access_key_id && !!secret_access_key;
          } else {
            const { access_key_id, secret_access_key } = hasAwsAccount
              ? (
                  await run(
                    tk,
                    backendUrl,
                    dbAlias,
                    `
                SELECT * FROM aws_credentials
              `,
                  )
                )?.[0]?.result?.[0]
              : { access_key_id: undefined, secret_access_key: undefined };
            const { default_aws_region: region } = hasAwsAccount
              ? (
                  await run(
                    tk,
                    backendUrl,
                    dbAlias,
                    `
                SELECT * FROM default_aws_region();
              `,
                  )
                )?.[0]?.result?.[0]
              : { default_aws_region: 'us-east-1' };
            // preview_sync if the database is new / only has aws_account
            // to see if credentials are valid
            const awsMods = mods.filter((n: any) => n.includes('aws'));
            if (awsMods.length === 1 && awsMods[0] === 'aws_account') {
              if (semver.lt(version, '0.0.23')) {
                await run(tk, backendUrl, dbAlias, `SELECT * FROM iasql_preview_sync();`);
              } else {
                await run(tk, backendUrl, dbAlias, `SELECT * FROM iasql_begin();`);
                await run(tk, backendUrl, dbAlias, `SELECT * FROM iasql_rollback();`);
              }
            }
            db.version = version;
            db.region = region;
            db.isReady = !!access_key_id && !!secret_access_key;
          }
        } catch (e: any) {
          Sentry.captureException(config, e);
          db.version = 'Unknown';
          db.region = 'Unknown';
          db.isReady = false;
        }
      } else {
        db.version = 'Unknown';
        db.region = 'Unknown';
        db.isReady = false;
      }
    }
    return dbs;
  };
  dbs = await getDbs(token);
  return dbs;
}

export async function run(token: string, backendUrl: string, dbAlias: string, sql: string) {
  const resp = await post(token, backendUrl, '', { dbAlias, sql });
  return resp.json();
}

export async function disconnect(token: string, backendUrl: string, dbAlias: string) {
  return (
    await run(token, backendUrl, 'iasql_metadata', `SELECT * FROM iasql_disconnect('${dbAlias}');`)
  )?.[0]?.result?.[0];
}

export async function getLatestVersion(token: string, backendUrl: string) {
  return (await run(token, backendUrl, 'iasql_metadata', `SELECT iasql_version();`))?.[0]?.result?.[0]
    ?.iasql_version;
}

export async function getOldestVersion(token: string, backendUrl: string) {
  return (await run(token, backendUrl, 'iasql_metadata', `SELECT iasql_version();`))?.[0]?.result?.[0]
    ?.iasql_version;
}
