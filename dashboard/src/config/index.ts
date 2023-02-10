import { ConfigInterface, throwError } from './config';

// To prevent side-effects for other environments' error handling, the specific config
// needs to be dynamically `require`d.
if (
  !['production', 'staging', 'local', 'test', 'ci', 'dev'].includes(process.env.REACT_APP_IASQL_ENV ?? '')
) {
  throwError(`Invalid environment ${process.env.REACT_APP_IASQL_ENV}`);
}
// tslint:disable-next-line:no-var-requires
const config: ConfigInterface = require(`./${process.env.REACT_APP_IASQL_ENV}`).default;

export default config;
