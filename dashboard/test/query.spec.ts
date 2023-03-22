import { expect, test } from '@playwright/test';

import { auth0, click, fill, isDisabled, isVisible, press } from './helper';

export default function createTests() {
  test('Query', async ({ page, browserName }) => {
    const { [`DB_ALIAS_${browserName}`]: dbAlias, [`IS_OSX_${browserName}`]: isOSx } = process.env;

    await auth0(page);

    await click(page.locator('#database-selection'));

    await click(page.locator(`span[role="none"]:has-text("${dbAlias}")`));

    // Ace editor visible
    await click(page.locator(`#iasql-editor`));

    // Check initial content
    await expect(page.locator(`#iasql-editor div.ace_content`)).toContainText(/\-\-\sWelcome\sto\sIaSQL/i);

    // Click run iasql
    await click(page.locator(`button:has-text("Run query")`));

    // Check response
    await click(
      page.locator(`#query-builder-result label`, {
        hasText: 'No results returned',
      }),
    );

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

    // Add long running query
    await fill(
      page.locator(`#iasql-editor textarea.ace_text-input`),
      "SELECT * FROM iasql_install('aws_cloudwatch');",
      false,
    );

    // Click run iasql
    await click(page.locator(`button:has-text("Run query")`));

    // Confirm run iasql is disabled
    await isDisabled(page.locator(`button:has-text("Run query")`));

    // Check response
    await click(page.locator(`#query-builder-result table`));

    // New queries should wait until previous ones finish execution
    await fill(page.locator(`#iasql-editor textarea.ace_text-input`), 'SELECT * FROM iasql_help();', false);

    // Click run iasql should do nothing but actually it does
    await press(
      page.locator(`#iasql-editor div.ace_content`),
      isOSx === 'true' ? 'Meta+Enter' : 'Control+Enter',
    );

    // Check response
    await click(page.locator(`#query-builder-result table`));

    // make sure the query builder result has ph-no-capture class
    await click(page.locator('#query-builder-result > .ph-no-capture'));
  });
}
