import { createConnection, } from 'typeorm'

import * as iasql from '../src/services/iasql'
export function getPrefix(){
  const chars = [
    Array(26).fill('a').map((c, i) => String.fromCharCode(c.charCodeAt() + i)),
    Array(26).fill('A').map((c, i) => String.fromCharCode(c.charCodeAt() + i)),
    Array(10).fill('0').map((c, i) => String.fromCharCode(c.charCodeAt() + i)),
  ].flat();
  const randChar = (): string => chars[Math.floor(Math.random() * chars.length)];
  return Array(7).fill('').map(() => randChar()).join('');
}

export function finish(done: (e?: any) => {}) {
  return [() => done(), (e: any) => { done(e); }];
}

export function runApply(dbAlias: string, done: (e?: any) => {}) {
  iasql.apply(dbAlias, false, 'not-needed').then(...finish(done));
}

export function query(queryString: string, dbAlias: string) {
  return function (done: (e?: any) => {}) {
    console.log(queryString);
    createConnection({
      name: dbAlias,
      type: 'postgres',
      username: 'postgres',
      password: 'test',
      host: 'localhost',
      port: 5432,
      database: dbAlias,
      extra: { ssl: false, },
    }).then((conn) => {
      conn.query(queryString).then(() => {
        conn.close().then(...finish(done));
      }, (e) => {
        conn.close().then(() => done(e), (e2) => done(e2));
      });
    }, done);
  }
}
