import ci from './ci';
import { ConfigEnvironments, ConfigInterface } from './config';
import debug from './debug';
import local from './local';
import production from './production';
import staging from './staging';
import test from './test';

const config: { [key in ConfigEnvironments]: ConfigInterface } = {
  production,
  staging,
  test,
  debug,
  ci,
  local,
};

export default config;
