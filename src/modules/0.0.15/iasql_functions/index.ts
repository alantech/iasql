/* THIS MODULE IS A SPECIAL SNOWFLAKE. DON'T LOOK AT IT FOR HOW TO WRITE A REAL MODULE */

import * as metadata from './module.json';
import { IasqlOperationType } from './entity';
import { Module2 } from '../../interfaces';

export const IasqlFunctions: Module2 = new Module2(
  {
    ...metadata,
    utils: {
      // Since this is a special module, this is provided so the scheduler can always get the 'latest'
      // operation types to check on. This also means that you can't drop old types willy-nilly
      IasqlOperationType,
    },
    mappers: {},
  },
  __dirname,
);
