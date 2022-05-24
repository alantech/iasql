import config from '../config'

// No good way to re-export a require without this, and no way to determine what to import by the
// config variable without require
// tslint:disable-next-line:no-var-requires
export const latest = require(`./${config.modules.latestVersion}`);

export * as v0_0_3 from './0.0.3'
export * as v0_0_4 from './0.0.4'
export * as v0_0_5 from './0.0.5'
export * as v0_0_6 from './0.0.6'
export * from './interfaces'
