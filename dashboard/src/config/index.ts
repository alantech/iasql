import { ConfigInterface, throwError } from './config';

// To prevent side-effects for other environments' error handling, the specific config
// needs to be dynamically `require`d.
if (
  !['production', 'staging', 'local', 'test', 'ci', 'dev'].includes(process.env.NEXT_PUBLIC_IASQL_ENV ?? '')
) {
  throwError(`Invalid environment ${process.env.NEXT_PUBLIC_IASQL_ENV}`);
}
// tslint:disable-next-line:no-var-requires
const config: ConfigInterface = require(`./${process.env.NEXT_PUBLIC_IASQL_ENV}`).default;

export default config;
