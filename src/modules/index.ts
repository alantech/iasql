import fs from 'fs'

import * as semver from 'semver'

import config from '../config'

// No good way to re-export a require without this, and no way to determine what to import by the
// config variable without require
// tslint:disable-next-line:no-var-requires
export const latest = require(`./${config.modules.latestVersion}`);

export const modules = Object.fromEntries(
  fs.readdirSync(__dirname, 'utf8').filter(m => semver.valid(m)).map(v => [`v${v.replace(/\./g, '_')}`, require(`./${v}`)])
);
modules.latest = latest;

export * from './interfaces'
