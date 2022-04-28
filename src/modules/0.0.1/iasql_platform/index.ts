/* THIS MODULE IS A SPECIAL SNOWFLAKE. DON'T LOOK AT IT FOR HOW TO WRITE A REAL MODULE */

import { Module, } from '../../interfaces'
import * as metadata from './module.json'

export const IasqlPlatform: Module = new Module({
  ...metadata,
  mappers: {},
}, __dirname);