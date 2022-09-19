import fs from 'fs';

export const createFns = fs.readFileSync(`${__dirname}/create_fns.sql`, 'utf8');
export const dropFns = fs.readFileSync(`${__dirname}/drop_fns.sql`, 'utf8');
