/* THIS MODULE IS A SPECIAL SNOWFLAKE. DON'T LOOK AT IT FOR HOW TO WRITE A REAL MODULE */
import { In, } from 'typeorm'

import { Context, Crud, Mapper, Module, } from '../interfaces'
import * as metadata from './module.json'
import { IasqlModule, } from './entity'

export const IasqlPlatform: Module = new Module({
  ...metadata,
  mappers: {
    iasqlModule: new Mapper<IasqlModule>({
      entity: IasqlModule,
      equals: (_a: IasqlModule, _b: IasqlModule) => true,
      source: 'db',
      cloud: new Crud({
        // We don't actually connect to AWS for this module, because it's meta
        create: async (_e: IasqlModule[], _ctx: Context) => { /* Do nothing */ },
        read: (ctx: Context, names?: string[]) => ctx.orm.find(IasqlModule, names ? {
          where: {
            name: In(names),
          },
        } : undefined),
        update: async (_e: IasqlModule[], _ctx: Context) => { /* Do nothing */ },
        delete: async (_e: IasqlModule[], _ctx: Context) => { /* Do nothing */ },
      }),
    }),
  },
}, __dirname);