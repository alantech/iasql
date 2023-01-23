import * as sentry from '@sentry/node';
import { execSync } from 'child_process';
import cluster from 'cluster';
import express from 'express';
import { existsSync, readdirSync, readFileSync } from 'fs';
import fetch from 'node-fetch';
import { cpus } from 'os';
import 'reflect-metadata';
import { createConnection } from 'typeorm';
import { inspect } from 'util';

import config from './config';
import { v1 } from './router';
import * as dbMan from './services/db-manager';
import logger from './services/logger';
import MetadataRepo from './services/repositories/metadata';

function startPrimary() {
  const numCpus = cpus().length;
  for (let i = 0; i < numCpus; i++) {
    cluster.fork();
  }

  cluster.on('exit', (_worker, code, signal) => {
    logger.warn('Child process died, restarting', { code, signal });
    cluster.fork();
  });
}

async function upgradeThenStartPrimary() {
  // First, make sure the metadata repo is up-to-date
  await MetadataRepo.init();
  const dbs = readdirSync('/tmp/upgrade');
  const dbsDone: { [key: string]: boolean } = {};
  for (const db of dbs) {
    logger.info(`Starting Part 2 of upgrading ${db}`);
    // Connect to the database and first re-insert the baseline modules
    const conn = await createConnection({
      ...dbMan.baseConnConfig,
      name: db,
      database: db,
    });
    await dbMan.migrate(conn);
    // Next re-insert the audit log
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
    logger.info(`Part 2 for ${db} complete!`);
    // Restoring the `aws_account` and other modules requires the engine to be fully started
    // We can't do that immediately, but we *can* create a polling job to do it as soon as the
    // engine has finished starting
    let upgradeRunning = false;
    const upgradeHandle = setInterval(async () => {
      const started = (await (await fetch(`http://localhost:${config.http.port}/health`)).text()) === 'ok';
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
  startPrimary();
}

if (cluster.isPrimary) {
  logger.info(`Using IASQL_ENV: ${process.env.IASQL_ENV}`);

  const dbsToUpgrade = existsSync('/tmp/upgrade');

  if (dbsToUpgrade) {
    upgradeThenStartPrimary();
  } else {
    MetadataRepo.init().then(startPrimary);
  }
} else {
  const port = config.http.port;
  const app = express();

  if (config.sentry) {
    sentry.init(config.sentry);
    // RequestHandler creates a separate execution context using domains, so that every
    // transaction/span/breadcrumb is attached to its own Hub instance
    app.use(sentry.Handlers.requestHandler());
  }
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.info(`Starting request on: ${req.path}`);
    const realSend = res.send;
    const start = Date.now();
    res.send = (body?: any) => {
      const end = Date.now();
      logger.info(`Request on: ${req.path} took ${end - start}ms`);
      return realSend.call(res, body);
    };
    next();
  });
  app.get('/health', (_, res) => res.send('ok'));
  app.use('/v1', v1);
  app.get('/debug-error', (_req, _res) => {
    throw new Error('Testing error handling!');
  });
  // The error handler must be before any other error middleware and after all controllers
  if (config.sentry) {
    app.use(
      sentry.Handlers.errorHandler({
        shouldHandleError(error) {
          // Capture all 4xx and 5xx errors
          if ((error?.status ?? 500) >= 400) return true;
          return false;
        },
      }),
    );
  }

  app.use((error: any, _req: any, res: any, _next: any) => {
    // The error id is attached to `res.sentry` to be returned
    // and optionally displayed to the user for support.
    logger.error(inspect(error));
    let msg = error.message || inspect(error);
    if (config.sentry) msg += `\nPlease provide this error ID when reporting this bug: ${res.sentry}`;
    return res.status(error.statusCode || error.status || 500).end(msg);
  });

  // init metadata repo
  MetadataRepo.init().then(() => {
    app.listen(port, () => {
      logger.info(`Server is running on port ${port}`);
    });
  });
}
