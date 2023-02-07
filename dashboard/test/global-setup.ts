import { chromium, firefox, webkit, FullConfig, BrowserType } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  checkGlobalEnv();
  const browsers = [chromium, firefox, webkit];
  for (const browser of browsers) {
    await configureBrowserAction(config, browser, 'setup');
  }
  return async () => {
    for (const browser of browsers) {
      await configureBrowserAction(config, browser, 'teardown');
    }
  }
}

function checkGlobalEnv() {
  process.env.TEST_ACCOUNT_EMAIL ?? throwError('No TEST_ACCOUNT_EMAIL defined.');
  process.env.TEST_ACCOUNT_PASSWORD ?? throwError('No TEST_ACCOUNT_PASSWORD defined.');
  process.env.AWS_ACCESS_KEY_ID ?? throwError('No AWS_ACCESS_KEY_ID defined.');
  process.env.AWS_SECRET_ACCESS_KEY ?? throwError('No AWS_SECRET_ACCESS_KEY defined.');
  process.env.WEBSITE_URL ?? throwError('No WEBSITE_URL defined.');
}

function throwError(message: string): never { throw new Error(message); }

async function configureBrowserAction(config: FullConfig, browserType: BrowserType, action: string) {
  const { REACT_APP_IASQL_ENV } = process.env;
  const projectConfig = config.projects.find(p => p.name === browserType.name());
  if (projectConfig) {
    const browser = await browserType.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await context.tracing.start({ screenshots: true, snapshots: true });
      switch (action) {
        case 'setup':
          const isOSx = (await page.evaluate(() => navigator.userAgent)).indexOf("Mac") !== -1;
          process.env[`IS_OSX_${browserType.name()}`] = (REACT_APP_IASQL_ENV === 'test' || REACT_APP_IASQL_ENV === 'staging') ? 'false' : `${isOSx}`;
          const { storageState } = projectConfig.use;
          const setUpDBAlias = `_${getRandStr()}`;
          process.env[`DB_ALIAS_${browserType.name()}`] = setUpDBAlias;
          await context.storageState({ path: storageState as string });
          break;
        default:
          break;
      }
      await context.tracing.stop({
        path: './test-results/setup-trace.zip',
      });
      await page.close();
    } catch(e) {
      await context.tracing.stop({
        path: './test-results/failed-setup-trace.zip',
      });
      await page.close();
      throw e;
    }
  }
}

function getRandStr(){
  const lowerCaseLetters = Array(26).fill('a').map((c, i) => String.fromCharCode(c.charCodeAt() + i));
  const digits = Array(10).fill('0').map((c, i) => String.fromCharCode(c.charCodeAt() + i));
  const chars = [ lowerCaseLetters, digits, ].flat();
  const randChar = (): string => chars[Math.floor(Math.random() * chars.length)];
  const randLetter = (): string => lowerCaseLetters[Math.floor(Math.random() * lowerCaseLetters.length)];
  return randLetter() + Array(6).fill('').map(() => randChar()).join('');
}

export default globalSetup;
