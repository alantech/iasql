import { test, } from '@playwright/test';

import { auth0, click, fill, isDisabled, isNotVisible, isVisible, } from './helper';

export default function createTests() {
  test('Connect using invalid credentials', async ({ page, browserName }) => {
    const { [`DB_ALIAS_${browserName}`]: dbAlias, } = process.env;

    await auth0(page);

    try {
      await page.locator('button:has-text("Connect Account")').waitFor({timeout: 20000})
      await click(
        page.locator('button:has-text("Connect Account")')
      );
    } catch (e) {
      await click(
        page.locator('#database-selection')
      )
      await click(
        page.locator('text=Connect account')
      )
    }

    await click(
      page.locator('input[name="db-alias"]')
    );

    await fill(
      page.locator('input[name="db-alias"]'),
      `${dbAlias}_invalid`
    );

    await click(
      page.locator('input[name="credentials-access-key-id"]')
    );

    await fill(
      page.locator('input[name="credentials-access-key-id"]'),
      'AWS_ACCESS_KEY_ID'
    );

    await click(
      page.locator('input[name="credentials-secret-access-key"]')
    );

    await fill(
      page.locator('input[name="credentials-secret-access-key"]'),
      'AWS_SECRET_ACCESS_KEY'
    );

    await click(
      page.locator('text=Next')
    );

    await isDisabled(page.locator('text=Finish'));
    
    await isDisabled(page.locator('text=Back'));

    await isVisible(
      page.locator(`.error-dialog`)
    );

    // Let's wait a couple of seconds to make sure the db got disconnected behind scenes
    await new Promise(r => setTimeout(r, 3000));

    // Lets refresh to make sure the db got disconnected
    await auth0(page);

    await click(
      page.locator('#database-selection')
    );

    await isNotVisible(page.locator(`span[role="none"]:has-text("${dbAlias}_invalid")`));

  });
}
