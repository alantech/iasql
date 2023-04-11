import { ConfigInterface, throwError } from './config';

type ConfigObj = ConfigInterface & { version: string };

export const IASQL_ENV = process.env.IASQL_ENV;
// To prevent side-effects for other environments' error handling, the specific config
// needs to be dynamically `require`d.
if (!['production', 'staging', 'local', 'test', 'ci', 'debug'].includes(IASQL_ENV ?? ''))
  throwError(`Invalid environment ${IASQL_ENV}`);
const config: ConfigObj = {
  // tslint:disable-next-line:no-var-requires
  ...require(`./${IASQL_ENV}`).default,
  version: '0.1.9',
};
if (!!config.sentry) config.sentry.release = config.version;

export default config;
