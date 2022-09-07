import fs from 'fs';

export const createTriggers = fs.readFileSync(`${__dirname}/create_triggers.sql`, 'utf8');
export const dropTriggers = fs.readFileSync(`${__dirname}/drop_triggers.sql`, 'utf8');
