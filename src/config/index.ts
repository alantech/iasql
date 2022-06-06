import { ConfigInterface, throwError, } from './config';

export const ENV = process.env.IASQL_ENV;
// To prevent side-effects for other environments' error handling, the specific config
// needs to be dynamically `require`d.
if (!['production', 'staging', 'local', 'test', 'ci'].includes(ENV ?? '')) throwError(
  `Invalid environment ${ENV}`
);
// tslint:disable-next-line:no-var-requires
const config: ConfigInterface = require(`./${ENV}`).default;

export default config;
