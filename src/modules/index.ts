import config from '../config'

// No good way to re-export a require without this, and no way to determine what to import by the
// config variable without require
// tslint:disable-next-line:no-var-requires
export const latest = require(`./${config.modules.latestVersion}`);

export * as v0_0_1 from './0.0.1'
export * as v0_0_2 from './0.0.2'
export * as v0_0_3 from './0.0.3'
export * from './interfaces'
