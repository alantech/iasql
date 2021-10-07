import * as express from 'express'
import config from '../config';
import { AWS } from '../services/gateways/aws';

import { db, } from './db'

const v1 = express.Router();

v1.use('/db', db)

export { v1 };