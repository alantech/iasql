import config from '../config'

// No good way to re-export a require without this, and no way to determine what to import by the
// config variable without require
// tslint:disable-next-line:no-var-requires
export const latest = require(`./${config.modules.latestVersion}`);

export * as v0_0_9 from './0.0.9'
export * as v0_0_10 from './0.0.10'
export * as v0_0_11 from './0.0.11'
export * as v0_0_12 from './0.0.12'
export * as v0_0_13 from './0.0.13'
export * from './interfaces'
