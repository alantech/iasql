import fs from 'fs';

export const createCustomConstraints = fs.readFileSync(`${__dirname}/create_custom_constraints.sql`, 'utf8');
export const dropCustomConstraints = fs.readFileSync(`${__dirname}/drop_custom_constraints.sql`, 'utf8');
