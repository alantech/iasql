import { test, } from '@playwright/test';

import { click, goTo, } from './helper';

export default function createTests() {
  test('The Button (use existing db)', async ({ page, browserName }) => {
    const { [`DB_ALIAS_${browserName}`]: dbAlias, } = process.env;

    await goTo(page, '#/button/Get%20the%20Version/SELECT%20*%20FROM%20iasql_version()');
  
    await click(
      page.locator(`text=${dbAlias}`)
    );
  
    await click(
      page.locator('button:text-is("Finish")')
    );
  
    await click(
      page.locator(`#iasql-editor div.ace_content:has-text("SELECT * FROM iasql_version()")`)
    );

  });
}
