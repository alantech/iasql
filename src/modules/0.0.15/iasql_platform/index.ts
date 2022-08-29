/* THIS MODULE IS A SPECIAL SNOWFLAKE. DON'T LOOK AT IT FOR HOW TO WRITE A REAL MODULE */
import { Module2 } from '../../interfaces';
import { IasqlModule, IasqlTables } from './entity';
import * as metadata from './module.json';

export const IasqlPlatform: Module2 = new Module2(
  {
    ...metadata,
    utils: {
      IasqlModule,
      IasqlTables,
    },
    mappers: {},
  },
  __dirname,
);
