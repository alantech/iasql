import { createConnection, getManager, getConnection, getConnectionManager, getRepository } from "typeorm";

import { Region } from '../entity/region'


export class RegionController {

  static async save(regions: Region[]) {
    const conn2 = await createConnection({
      name: '__example__',
      type: 'postgres',
      username: 'postgres',
      password: 'test',
      host: 'postgresql',
      database: 'typeorm', // TODO remove hardcoded database
      entities: [`${__dirname}/../entity/**/*.js`]
    });
    const regionRepository = await conn2.manager.getRepository(Region);
    await regionRepository.save(regions)
  }

}