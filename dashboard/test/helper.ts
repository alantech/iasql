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