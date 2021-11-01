import * as express from 'express'

import { db, } from './db'
import { iasql, } from './iasql'

const v1 = express.Router();

v1.use('/db', db)
v1.use('/iasql', iasql)

export { v1 };