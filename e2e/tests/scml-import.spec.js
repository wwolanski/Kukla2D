import { expect, test } from '@playwright/test';
import { readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCML_DIR = resolve(__dirname, '../../test/fixtures/scml/Forest_Ranger_1');
const SCML_FILES = readdirSync(SCML_DIR).map(name => resolve(SCML_DIR, name));

test('imports Spriter project into visible staging pose and native bone tree', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/?renderer=pixi');
  const canvas = page.locator('canvas');
  const emptyCanvas = await canvas.screenshot();

  await page.getByTitle('Load project').click();
  await page.getByRole('tab', { name: 'External Import' }).click();
  await page.locator('input[accept^=".scml"]').setInputFiles(SCML_FILES);
  await expect(page.getByRole('button', { name: 'Skip' })).toBeVisible();
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page.getByRole('button', { name: 'Animation', exact: true })).toBeVisible();

  const importedCanvas = await canvas.screenshot();
  expect(importedCanvas.equals(emptyCanvas)).toBe(false);

  await page.getByRole('button', { name: 'DRAW ORDER' }).click();
  const orderedNames = await page.locator('span[title]').evaluateAll(elements => elements.map(element => element.getAttribute('title')));
  expect(orderedNames.indexOf('Head')).toBeLessThan(orderedNames.indexOf('Body'));
  await page.locator('span[title="Body"]').first().click();
  await expect(page.getByTestId('transform-x')).not.toHaveValue('0.0');
  await expect(page.getByTestId('transform-y')).not.toHaveValue('0.0');
  await expect(page.getByRole('slider').first()).toHaveAttribute('aria-valuenow', '100');

  await page.getByRole('button', { name: 'Bones', exact: true }).click();
  await expect(page.getByText('bone_000', { exact: true })).toBeVisible();
  await expect(page.getByText('bone_001', { exact: true })).toBeVisible();
  await expect(page.locator('span[title="Body"]').first()).toBeVisible();
  await expect(page.locator('span[title="Head"]').first()).toBeVisible();
  expect(pageErrors).toEqual([]);
});
