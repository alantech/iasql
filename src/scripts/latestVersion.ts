import fs from 'fs';

import * as semver from 'semver';

/* tslint:disable no-console */
console.log(
  fs
    .readdirSync(`${__dirname}/../modules`, 'utf8')
    .filter(r => semver.valid(r))
    .sort((a, b) => (semver.lt(a, b) ? -1 : 1))
    .pop()
);
