import * as express from 'express'

import { db, } from './db'
import { mod, } from './module'

const v1 = express.Router();

v1.use('/db', db)
v1.use('/module', mod)

export { v1 };