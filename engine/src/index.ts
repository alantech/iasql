import 'reflect-metadata';
import express from 'express';
import { inspect } from 'util';
import * as sentry from "@sentry/node";

import config from './config';
import { v1 } from './router';

const port = config.port;
const app = express();

if (config.sentryEnabled) {
  sentry.init({
    dsn: config.sentryDsn,
  });
  // RequestHandler creates a separate execution context using domains, so that every
  // transaction/span/breadcrumb is attached to its own Hub instance
  app.use(sentry.Handlers.requestHandler());
}
app.get('/health', (_, res) => res.send('ok'));
app.use('/v1', v1);
app.get('/debug-error', (req, res) => { throw new Error("Testing error handling!") });
// The error handler must be before any other error middleware and after all controllers
if (config.sentryEnabled) {
  app.use(
    sentry.Handlers.errorHandler({
      shouldHandleError(error) {
        // Capture all 4xx and 5xx errors
        if ((error?.status ?? 500) >= 400) return true;
        return false;
      },
    })
  );
}

app.use((error: any, _req: any, res: any, _next: any) => {
  // The error id is attached to `res.sentry` to be returned
  // and optionally displayed to the user for support.
  console.error(inspect(error));
  let msg = error.message || inspect(error);
  if (config.sentryEnabled) msg += `\nPlease provide this error ID when reporting this bug: ${res.sentry}\n`;
  return res
    .status(error.statusCode || error.status || 500)
    .end(msg);
});
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
