import { expect, Locator, Page, } from '@playwright/test';

export async function isVisible(loc: Locator) {
  await loc.waitFor();
  expect(loc).toBeDefined();
  await expect(loc).toBeVisible();
}

export async function isNotVisible(loc: Locator) {
  await expect(loc).toBeHidden();
}

export async function isDisabled(loc: Locator) {
  await isVisible(loc);
  await expect(loc).toBeDisabled();
}

export async function press(loc: Locator, keys: string) {
  await isVisible(loc);
  await loc.press(keys);
}

export async function click(loc: Locator, force=false) {
  await isVisible(loc);
  await loc.click({ force });
}

export async function fill(loc: Locator, val: string, validate=true) {
  expect(loc).toBeDefined();
  // Clean content
  await loc.fill('');
  await loc.fill(val);
  if (validate) await expect(loc).toHaveValue(val);
}

export async function goTo(page: Page, path?: string) {
  await page.goto(`${process.env.WEBSITE_URL ?? ''}${path ? path : ''}`);
}

export async function auth0(page: Page, path?: string) {
  const { TEST_ACCOUNT_EMAIL, TEST_ACCOUNT_PASSWORD, IASQL_ENV } = process.env;

  await goTo(page, path);
  // Auth is only enabled when testing directly against staging.
  if (IASQL_ENV === 'staging') {
    // Check if we are redirected to auth0
    await page.waitForSelector('input[name="username"]');
    // If selector found we login
    await click(
      page.locator('input[name="username"]')
    );
    await fill(
      page.locator('input[name="username"]'),
      TEST_ACCOUNT_EMAIL ?? ''
    );
    await click(
      page.locator('input[name="password"]')
    );
    await fill(
      page.locator('input[name="password"]'),
      TEST_ACCOUNT_PASSWORD ?? ''
    );
    await Promise.all([
      click(
        page.locator('button:has-text("Continue")')
      ),
      page.waitForNavigation()
    ]);
  }
}
