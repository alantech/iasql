import ci from './ci';
import { ConfigEnvironments, ConfigInterface } from './config';
import dev from './dev';
import local from './local';
import production from './production';
import staging from './staging';
import test from './test';

const config: { [key in ConfigEnvironments]: ConfigInterface } = {
  production,
  staging,
  test,
  dev,
  ci,
  local,
};

export default config;
