import { test, } from '@playwright/test';

import { auth0, click, fill, } from './helper';

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
  
    // Add long running query and then disconnect to confirm that the query is cancelled
    await fill(
      page.locator(`#iasql-editor textarea.ace_text-input`),
      "SELECT * FROM iasql_install('aws_ecs_fargate');",
      false,
    );

    // Click run query
    await click(page.locator(`button:has-text("Run query")`));

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
