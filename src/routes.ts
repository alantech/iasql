import * as express from 'express'
import * as fs from 'fs'
import { createConnection, } from 'typeorm'

import { AWS } from './services/gateways/aws'
import config from './config'

const v1 = express.Router();

v1.get('/create/:db', async (req, res) => {
  // TODO: Clean/validate this input
  const dbname = req.params['db'];
  const template = fs.readFileSync(`${__dirname}/template.sql`, 'utf8');
  try {
    const conn1 = await createConnection({
      type: 'postgres',
      username: 'postgres',
      password: 'test',
      host: 'postgresql',
    });
    const resp1 = await conn1.query(`
      CREATE DATABASE ${dbname};
    `);
    const conn2 = await createConnection({
      type: 'postgres',
      username: 'postgres',
      password: 'test',
      host: 'postgresql',
      database: dbname,
    });
    const resp2 = await conn2.query(template);
    conn1.close();
    conn2.close();
    res.end(`create ${dbname}: ${JSON.stringify(resp1)} ${JSON.stringify(resp2)}`);
  } catch (e: any) {
    res.end(`failure to create DB: ${e?.message ?? ''}`);
  }
});

v1.get('/delete/:db', async (req, res) => {
  // TODO: Clean/validate this input
  const dbname = req.params['db'];
  try {
    const conn = await createConnection({
      type: 'postgres',
      username: 'postgres',
      password: 'test',
      host: 'postgresql',
    });
    await conn.query(`
      DROP DATABASE ${dbname};
    `);
    conn.close();
    res.end(`delete ${dbname}`);
  } catch (e: any) {
    res.end(`failure to drop DB: ${e?.message ?? ''}`);
  }
});

v1.get('/check/:db', async (req, res) => {
  // TODO: Clean/validate this input
  const dbname = req.params['db'];
  try {
    const conn = await createConnection({
      type: 'postgres',
      username: 'postgres',
      password: 'test',
      host: 'postgresql',
      database: dbname,
    });
    // TODO actually use database records
    const awsClient = new AWS({ region: config.region ?? 'eu-west-1', credentials: { accessKeyId: config.accessKeyId ?? '', secretAccessKey: config.secretAccessKey ?? '' } })
    const awsInstances = await awsClient.getInstances()
    let awsInstanceIds: string[] = []
    awsInstances?.Reservations?.forEach((r) => {
      const rInstancesIds: string[] = r.Instances?.filter(i => i.State?.Name === 'running').map((i) => i.InstanceId ?? '') ?? []
      awsInstanceIds = awsInstanceIds.concat(rInstancesIds)
    });
    const instancesToCreate = await conn.query(`
      select instance.id, instance_type.instance_type
      from instance
      left join instance_type on instance.instance_type_id = instance_type.instance_type_id
      where instance.instance_id not in ${awsInstanceIds}
      or instance.instance_id is null
    `);
    await Promise.all(instancesToCreate.map(async (i: any) => {
      const newInstanceId = await awsClient.newInstance(i['instance_type']);
      await conn.query(`update instance set instance_id = ${newInstanceId} where id = ${i.id}`);
    }));
    console.log(await conn.query(`select * from instance`));
    conn.close();
    res.end(`check ${dbname}`);
  } catch (e: any) {
    res.end(`failure to check DB: ${e?.message ?? ''}`);
  }
});

export { v1 };
