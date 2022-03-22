import { ConfigInterface, throwError, } from './config';
import production from './production';
import staging from './staging';
import local from './local';
import test from './test';

const config: ConfigInterface =
  process.env.IASQL_ENV === 'production' ?
    production :
  process.env.IASQL_ENV === 'staging' ?
    staging :
  process.env.IASQL_ENV === 'local' ?
    local :
  process.env.IASQL_ENV === 'test' ?
    test :
  throwError(`Invalid environment ${process.env.IASQL_ENV}`);

export default config;
