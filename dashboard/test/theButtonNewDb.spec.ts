import { test, } from '@playwright/test';

import { auth0, click, fill, isDisabled, } from './helper';

export default function createTests() {
  test('The Button (new db)', async ({ page, }) => {
    const {AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, } = process.env;

    await auth0(page, '#/button/Get%20the%20Version/SELECT%20*%20FROM%20iasql_version()');
  
    await click(
      page.locator(`text=Create a new Database`)
    );
    
    await click(
      page.locator('button:text-is("Next")')
    );

    await page.locator(`text=AWS Access Key ID`).waitFor();

    await page.locator('input[name="credentials-access-key-id"]').waitFor();

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
      page.locator('button:text-is("Next")')
    );
  
    await isDisabled(page.locator(`button:text-is("Finish")`));
  
    await click(
      page.locator('button:text-is("Finish")')
    );
  
    await click(
      page.locator(`#iasql-editor div.ace_content:has-text("SELECT * FROM iasql_version()")`)
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
