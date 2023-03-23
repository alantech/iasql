import { test, } from '@playwright/test';

import { goTo, click, } from './helper';

export default function createTests() {
  test('Uninstall module', async ({ page, browserName }) => {
    const { [`DB_ALIAS_${browserName}`]: dbAlias } = process.env;

    await goTo(page);
  
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
  
    await click(page.locator(`#query-builder-result table`));
  
  });
}
