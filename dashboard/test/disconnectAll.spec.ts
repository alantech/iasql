import { test } from '@playwright/test';

import { auth0, click } from './helper';

export default function createTests() {
  test(`Make sure all dbs have been disconnected`, async ({ page }) => {
    test.setTimeout(5 * 60 * 1000); // 5 min test
    await auth0(page);
    let hasDbs = true;
    do {
      try {
        await page.locator('button:has-text("Connect Account")').waitFor({ timeout: 20000 });
        await click(page.locator('button:has-text("Connect Account")'));
        hasDbs = false;
      } catch (e) {
        // We still have dbs to disconnect
        await click(page.locator('#database-selection'));
      }
      if (hasDbs) {
        await click(page.locator(`#db-selection-list > div:first-child`));

        await click(page.locator(`button:has-text("Disconnect")`));

        await click(page.locator(`button#disconnect-modal:has-text("Disconnect")`));
      }
    } while (hasDbs);
  });
}
