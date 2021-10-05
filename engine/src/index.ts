import 'reflect-metadata';
import express from 'express';
import { inspect } from 'util';

import config from './config';
import { v1 } from './router';

const port = config.port;
const app = express();

app.get('/health', (_, res) => res.send('ok'));
app.use('/v1', v1);
app.use((error: any, _req: any, res: any, _next: any) => {
  console.error(inspect(error));
  return res
    .status(error.statusCode || error.status || 500)
    .end(error.message || inspect(error));
});
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
