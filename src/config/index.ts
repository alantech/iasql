import { ConfigInterface, throwError } from './config';

export const IASQL_ENV = process.env.IASQL_ENV;
// To prevent side-effects for other environments' error handling, the specific config
// needs to be dynamically `require`d.
if (!['production', 'staging', 'local', 'test', 'ci'].includes(IASQL_ENV ?? ''))
  throwError(`Invalid environment ${IASQL_ENV}`);
// tslint:disable-next-line:no-var-requires
const config: ConfigInterface = require(`./${IASQL_ENV}`).default;

export default config;
