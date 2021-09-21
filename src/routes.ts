import * as express from 'express'
import * as fs from 'fs'
import knex from 'knex'

import { AWS } from './services/gateways/aws'
import config from './config'
import { inspect } from 'util'

const v1 = express.Router();

v1.get('/create/:db', async (req, res) => {
  // TODO: Clean/validate this input
  const dbname = req.params['db'];
  const template = fs.readFileSync(`${__dirname}/template.sql`, 'utf8');
  try {
    const conn1 = knex({
      client: 'pg',
      connection: {
        user: 'postgres',
        password: 'test',
        host: 'postgresql',
      },
    });
    const resp1 = await conn1.raw(`
      CREATE DATABASE ${dbname};
    `);
    const conn2 = knex({
      client: 'pg',
      connection: {
        user: 'postgres',
        password: 'test',
        host: 'postgresql',
        database: dbname,
      },
    });
    const resp2 = await conn2.raw(template);
    conn1.destroy();
    conn2.destroy();
    res.end(`create ${dbname}: ${JSON.stringify(resp1)} ${JSON.stringify(resp2)}`);
  } catch (e: any) {
    res.end(`failure to create DB: ${e?.message ?? ''}`);
  }
});

v1.get('/delete/:db', async (req, res) => {
  // TODO: Clean/validate this input
  const dbname = req.params['db'];
  try {
    const conn = knex({
      client: 'pg',
      connection: {
        user: 'postgres',
        password: 'test',
        host: 'postgresql',
      },
    });
    const resp1 = await conn.raw(`
      DROP DATABASE ${dbname};
    `);
    conn.destroy();
    res.end(`delete ${dbname}`);
  } catch (e: any) {
    res.end(`failure to drop DB: ${e?.message ?? ''}`);
  }
});

v1.get('/check/:db', async (req, res) => {
  // TODO: Clean/validate this input
  const dbname = req.params['db'];
  try {
    const conn = knex({
      client: 'pg',
      connection: {
        user: 'postgres',
        password: 'test',
        host: 'postgresql',
        database: dbname,
      },
    });
    //const resp1 = await conn.select(``);
    // TODO actually use database records
    const awsClient = new AWS({ region: config.region ?? 'eu-west-1', credentials: { accessKeyId: config.accessKeyId ?? '', secretAccessKey: config.secretAccessKey ?? '' } })
    const awsInstances = await awsClient.getInstances()
    let awsInstanceIds: string[] = []
    awsInstances?.Reservations?.forEach((r) => {
      const rInstancesIds: string[] = r.Instances?.filter(i => i.State?.Name === 'running').map((i) => i.InstanceId ?? '') ?? []
      awsInstanceIds = awsInstanceIds.concat(rInstancesIds)
    });
    const instancesToCreate = await conn.select('instance.id', 'instance_type.instance_type').table('instance')
      .leftJoin('instance_type', 'instance.instance_type_id', 'instance_type.instance_type_id')
      .whereNotIn('instance.instance_id', awsInstanceIds)
      .orWhereNull('instance.instance_id')
    await Promise.all(instancesToCreate.map(async (i) => {
      const newInstanceId = await awsClient.newInstance(i['instance_type']);
      await conn.table('instance').where({ id: i.id }).update({ 'instance_id': newInstanceId })
    }))
    console.log(await conn.select().table('instance'))
    conn.destroy();
    res.end(`check ${dbname}`);
  } catch (e: any) {
    res.end(`failure to check DB: ${e?.message ?? ''}`);
  }
});

export { v1 };
