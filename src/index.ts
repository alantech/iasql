import * as sentry from '@sentry/node';
import cluster from 'cluster';
import cors from 'cors';
import express from 'express';
import { cpus } from 'os';
import 'reflect-metadata';
import { inspect } from 'util';

import config from './config';
import { v1 } from './router';
import logger from './services/logger';
import MetadataRepo from './services/repositories/metadata';

if (cluster.isPrimary) {
  logger.info(`Using IASQL_ENV: ${process.env.IASQL_ENV}`);
  const numCpus = cpus().length;
  for (let i = 0; i < numCpus; i++) {
    cluster.fork();
  }

  cluster.on('exit', (_worker, code, signal) => {
    logger.warn('Child process died, restarting', { code, signal });
    cluster.fork();
  });
} else {
  const port = config.http.port;
  const app = express();

  if (config.cors) {
    app.use(
      cors({
        origin: config.cors.origin,
      }),
    );
  }
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
