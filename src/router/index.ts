import * as express from 'express';

import config from '../config';
// routes
import { db } from './db';

const v1 = express.Router();
// 10 GB post payload limit for import dumps
v1.use(express.json({ limit: '10000MB' }));
v1.use(express.text({ limit: '10000MB' }));
// TODO secure with scope
v1.use('/db', db);
v1.get('/version', (_req, res) => res.send(config.version));

export { v1 };
