import fs from 'fs';

import * as semver from 'semver';

export const modules = Object.fromEntries(
  fs
    .readdirSync(__dirname, 'utf8')
    .filter(m => semver.valid(m))
    .map(v => [v, require(`./${v}`)])
);

export * from './interfaces';
