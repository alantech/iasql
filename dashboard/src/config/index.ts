import ci from './ci';
import { ConfigEnvironments, ConfigInterface } from './config';
import debug from './debug';
import local from './local';
import test from './test';

const config: { [key in ConfigEnvironments]: ConfigInterface } = {
  test,
  debug,
  ci,
  local,
};

export default config;
