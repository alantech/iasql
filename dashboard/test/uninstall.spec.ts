import { test, } from '@playwright/test';

import { auth0, click, } from './helper';

export default function createTests() {
  test('Uninstall module', async ({ page, browserName }) => {
    const { [`DB_ALIAS_${browserName}`]: dbAlias } = process.env;

    await auth0(page);
  
    await click(
      page.locator('#database-selection')
    );
    
    await click(
      page.locator(`span[role="none"]:has-text("${dbAlias}")`)
    );
  
    await click(
      page.locator(`button:text-is("Uninstall") >> nth=0`)
    );
  
    await click(
      page.locator(`#iasql-editor div.ace_content:has-text("iasql_uninstall")`)
    );
  
    await click(
      page.locator(`button:has-text("Run query")`)
    );
  
  });
}
