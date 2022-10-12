import fs from 'fs';
import * as semver from 'semver';

// Returns a comma separated string with the available versions (from oldest to newest)
/* tslint:disable no-console */
console.log(
  fs
    .readdirSync(`${__dirname}/../modules`, 'utf8')
    .filter(r => semver.valid(r))
    .sort((a, b) => (semver.lt(a, b) ? -1 : 1))
    .join(','),
);
