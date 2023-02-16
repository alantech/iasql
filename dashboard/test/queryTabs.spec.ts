import { test } from '@playwright/test';

import { auth0, click, fill, isDisabled, isVisible, press } from './helper';

export default function createTests() {
  test('Query Tabs', async ({ page, browserName }) => {
    const { [`DB_ALIAS_${browserName}`]: dbAlias, [`IS_OSX_${browserName}`]: isOSx } = process.env;

    await auth0(page);

    await click(page.locator('#database-selection'));

    await click(page.locator(`span[role="none"]:has-text("${dbAlias}")`));

    // Ace editor visible
    await click(page.locator(`#iasql-editor`));

    // Check initial content
    await click(page.locator(`#iasql-editor div.ace_content:has-text("SELECT * FROM iasql_help();")`));

    // Click run iasql initial query
    await click(page.locator(`button:has-text("Run query")`));

    // Check response
    await click(page.locator(`#query-builder-result table`));

    // Create new tab
    await click(page.locator(`#tabs-and-editor button:has-text("+")`));

    // Add fake query
    await fill(page.locator(`#iasql-editor textarea.ace_text-input`), 'SELECT * FROM fake_table;', false);

    await isVisible(page.locator(`#iasql-editor div.ace_content:has-text("SELECT * FROM fake_table;")`));

    // Execute with Ctrl/Cmd + Enter
    await press(
      page.locator(`#iasql-editor div.ace_content`),
      isOSx === 'true' ? 'Meta+Enter' : 'Control+Enter',
    );

    // Check failed result
    await click(
      page.locator(`#query-builder-result label`, {
        hasText: 'Error: relation "fake_table" does not exist',
      }),
    );

    // Go back to 'Welcome' tab
    await click(page.locator(`#tabs-and-editor button#Welcome`));

    // Check the result sill there
    await click(page.locator(`#query-builder-result table`));

    // Go back to first tab
    await click(page.locator(`#tabs-and-editor button#Query-1`));

    // Check the result sill there
    await click(
      page.locator(`#query-builder-result label`, {
        hasText: 'Error: relation "fake_table" does not exist',
      }),
    );

    // Close tab
    await click(page.locator(`#tabs-and-editor button#Query-1 #close-bttn`));

    // Check initial welcome tab content
    await click(page.locator(`#iasql-editor div.ace_content:has-text("SELECT * FROM iasql_help();")`));

    // Check the result sill there
    await click(page.locator(`#query-builder-result table`));

  });
}
