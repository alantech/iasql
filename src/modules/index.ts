import config from '../config'

export const latest = require(`./${config.modules.latestVersion}`);

export * as v0_0_1 from './0.0.1'
export * as v0_0_2 from './0.0.2'
export * as v0_0_3 from './0.0.3'
export * from './interfaces'
