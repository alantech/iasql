import { test, } from '@playwright/test';

import { auth0, click, fill, isDisabled, isVisible, } from './helper';

export default function createTests() {
  test('Connect account', async ({ page, browserName }) => {
    const { [`DB_ALIAS_${browserName}`]: dbAlias, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, } = process.env;

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
      dbAlias!
    );

    await click(
      page.locator('input[name="credentials-access-key-id"]')
    );

    await fill(
      page.locator('input[name="credentials-access-key-id"]'),
      AWS_ACCESS_KEY_ID ?? ''
    );

    await click(
      page.locator('input[name="credentials-secret-access-key"]')
    );

    await fill(
      page.locator('input[name="credentials-secret-access-key"]'),
      AWS_SECRET_ACCESS_KEY ?? ''
    );

    await click(
      page.locator('text=Next')
    );

    await isDisabled(page.locator('text=Finish'));
    
    await isDisabled(page.locator('text=Back'));

    await click(
      page.locator('text=Finish')
    );

    await isVisible(
      page.locator(`button:has-text("${dbAlias}")`)
    )
  });
}
