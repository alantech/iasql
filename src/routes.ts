import * as express from 'express'
import * as fs from 'fs'
import knex from 'knex'
import path from 'path'

const v1 = express.Router();

v1.get('/create/:db', async (req, res) => {
  // TODO: Clean/validate this input
  const dbname = req.params['db'];
  const dist = path.resolve(__dirname, '../dist')
  const template = fs.readFileSync(`${dist}/template.sql`, 'utf8');
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
    const templateRes = await conn2.raw(template);
    conn1.destroy();
    conn2.destroy();
    res.end(`create ${dbname}: ${JSON.stringify(resp1)} ${JSON.stringify(templateRes)}`);
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

export { v1 };
