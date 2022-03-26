import { ConfigInterface, throwError, } from './config';

// To prevent side-effects for other environments' error handling, the specific config
// needs to be dynamically `require`d.
if (!['production', 'staging', 'local', 'test', 'simple-integration-test'].includes(process.env.IASQL_ENV ?? '')) throwError(
  `Invalid environment ${process.env.IASQL_ENV}`
);
console.log(`Using IASQL_ENV: ${process.env.IASQL_ENV}`);
// tslint:disable-next-line:no-var-requires
const config: ConfigInterface = require(`./${process.env.IASQL_ENV}`).default;

export default config;
