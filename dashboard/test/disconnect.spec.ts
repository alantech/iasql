import { test, } from '@playwright/test';

import { auth0, click, } from './helper';

export default function createTests() {
  test('Disconnect account', async ({ page, browserName }) => {
    const { [`DB_ALIAS_${browserName}`]: dbAlias, } = process.env;

    await auth0(page);

    await click(
      page.locator('#database-selection')
    );
    
    await click(
      page.locator(`span[role="none"]:has-text("${dbAlias}")`)
    );
  
    await click(
      page.locator('#database-settings')
    );
  
    await click(
      page.locator(`button:has-text("Disconnect")`)
    );
  
    await click(
      page.locator(`button#disconnect-modal:has-text("Disconnect")`)
    );
  });
}
