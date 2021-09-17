import * as http from 'http'
import * as fs from 'fs'
import knex from 'knex'

const template = fs.readFileSync(`${__dirname}/template.sql`, 'utf8');

const server = http.createServer(async (req, res) => {
  if (/^\/create\/.*/.test(req.url ?? '')) {
    // TODO: Clean/validate this input
    const dbname = (/^\/create\/(.*)/.exec(req.url ?? '') ?? [])[1];
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
      const resp2 = await conn2.raw(template)
      res.end(`create ${dbname}: ${JSON.stringify(resp1)} ${JSON.stringify(resp2)}`);
    } catch (e: any) {
      res.end(`failure to create DB: ${e?.message ?? ''}`);
    }
  } else if (/^\/delete\/.*/.test(req.url ?? '')) {
    // TODO: Clean/validate this input
    const dbname = (/^\/delete\/(.*)/.exec(req.url ?? '') ?? [])[1];
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
      res.end(`delete ${dbname}`);
    } catch (e: any) {
      res.end(`failure to drop DB: ${e?.message ?? ''}`);
    }
  } else {
    res.end('Hello, World!');
  }
});
server.listen(8088);
