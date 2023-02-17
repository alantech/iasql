import { test } from '@playwright/test';

import connect from './connect.spec';
import disconnect from './disconnect.spec';
import disconnectAll from './disconnectAll.spec';
import install from './install.spec';
import query from './query.spec';
import querySidebar from './querySidebar.spec';
import queryTabs from './queryTabs.spec';
// import theButtonExistingDb from './theButtonExistingDb.spec';
// import theButtonNewDb from './theButtonNewDb.spec';
// import theButtonNewDbCleanAccount from './theButtonNewDbCleanAccount.spec';
import uninstall from './uninstall.spec';

test.describe('disconnect all databases', disconnectAll);
test.describe('connect', connect);
test.describe('install', install);
test.describe('uninstall', uninstall);
test.describe('query', query);
test.describe('querySidebar', querySidebar);
test.describe('queryTabs', queryTabs);
// TODO: revive
// test.describe('theButton new db', theButtonNewDb);
// test.describe('theButton existing db', theButtonExistingDb);
test.describe('disconnect', disconnect);
// TODO: revive
// test.describe('theButton new db in account without dbs', theButtonNewDbCleanAccount);
