import { test, } from '@playwright/test';

import { click, goTo } from './helper';

export default function createTests() {
  test('Install module', async ({ page, browserName }) => {
    const { [`DB_ALIAS_${browserName}`]: dbAlias } = process.env;

    await goTo(page);
  
    await click(
      page.locator('#database-selection')
    );
  
    await click(
      page.locator(`span[role="none"]:has-text("${dbAlias}")`)
    );
  
    await click(
      page.locator(`button:text-is("Install") >> nth=0`)
    );
  
    await click(
      page.locator(`#iasql-editor div.ace_content:has-text("iasql_install")`)
    );
  
    await click(page.locator(`#query-builder-result table`));
  
  });
}
