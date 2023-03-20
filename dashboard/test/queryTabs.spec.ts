import { expect, test } from '@playwright/test';

import { auth0, click, fill, isDisabled, isNotVisible, isVisible, press } from './helper';

export default function createTests() {
  test('Query Tabs', async ({ page, browserName }) => {
    const { [`DB_ALIAS_${browserName}`]: dbAlias, [`IS_OSX_${browserName}`]: isOSx } = process.env;

    await auth0(page);

    await click(page.locator('#database-selection'));

    await click(page.locator(`span[role="none"]:has-text("${dbAlias}")`));

    // Ace editor visible
    await click(page.locator(`#iasql-editor`));

    // Check initial content
    await expect(page.locator(`#iasql-editor div.ace_content`)).toContainText(/\-\-\sWelcome\sto\sIaSQL/i);
    
    // Add iasql_help query
    await fill(page.locator(`#iasql-editor textarea.ace_text-input`), "SELECT * FROM iasql_help();", false);

    // Click run iasql initial query
    await click(page.locator(`button:has-text("Run query")`));

    // Check response
    await click(page.locator(`#query-builder-result table`));

    // Create new tab
    await click(page.locator(`#tabs-and-editor button:has-text("+")`));

    // Add long running query
    await fill(page.locator(`#iasql-editor textarea.ace_text-input`), "SELECT * FROM iasql_install('aws_ec2');", false);

    await isVisible(page.locator(`#iasql-editor div.ace_content:has-text("SELECT * FROM iasql_install('aws_ec2');")`));

    // Click run iasql
    await click(page.locator(`button:has-text("Run query")`));

    // Confirm cannot select a new db
    await isDisabled(page.locator(`#database-selection`));

    // Confirm cannot close tab
    await isNotVisible(page.locator(`#tabs-and-editor button#query-1 #close-bttn`));

    // Check result
    await click(page.locator(`#query-builder-result table`));

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
    await click(page.locator(`#tabs-and-editor button#getting-started`));

    // Check the result sill there
    await click(page.locator(`#query-builder-result table`));

    // Go back to first tab
    await click(page.locator(`#tabs-and-editor button#query-1`));

    // Check the result sill there
    await click(
      page.locator(`#query-builder-result label`, {
        hasText: 'Error: relation "fake_table" does not exist',
      }),
    );

    // Close tab
    await click(page.locator(`#tabs-and-editor button#query-1 #close-bttn`));

    // Check initial welcome tab content
    await click(page.locator(`#iasql-editor div.ace_content:has-text("SELECT * FROM iasql_help();")`));

    // Check the result sill there
    await click(page.locator(`#query-builder-result table`));

  });
}
