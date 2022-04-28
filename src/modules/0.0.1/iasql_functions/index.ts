/* THIS MODULE IS A SPECIAL SNOWFLAKE. DON'T LOOK AT IT FOR HOW TO WRITE A REAL MODULE */

import { Module, } from 'iasql/modules'
import * as metadata from './module.json'

export const IasqlFunctions: Module = new Module({
  ...metadata,
  mappers: {},
}, __dirname);