import { test, } from '@playwright/test';

import { auth0, click, } from './helper';

export default function createTests() {
  test('Query sidebar', async ({ page, browserName, }) => {
    const { [`DB_ALIAS_${browserName}`]: dbAlias } = process.env;

    await auth0(page);

    await click(
      page.locator('#database-selection')
    );
  
    await click(
      page.locator(`span[role="none"]:has-text("${dbAlias}")`)
    );

    // Click on schema in sidebar
    await click(
      page.locator(`#query-sidebar button:has-text("Schema")`)
    );

    // Close modules accordion
    await click(
      page.locator(`#accordion-modules`), true
    );
  
    // Check iasql_version function is defined
    await click(
      page.locator(`span:has-text("iasql_version")`)
    );

    // Close functions accordion
    await click(
      page.locator(`#accordion-functions`)
    );

    // Open modules accordion
    await click(
      page.locator(`#accordion-modules`), true
    );

    // Click first table with action enabled
    await click(page.locator(`:nth-match(.action, 2)`));

    // Check response
    await click(page.locator(`#query-builder-result table`));

  });
}
