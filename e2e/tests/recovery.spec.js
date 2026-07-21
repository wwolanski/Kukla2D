import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import JSZip from 'jszip';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = resolve(__dirname, '../fixtures/animation-mvp-project.json');

async function fixtureFile() {
  const zip = new JSZip();
  zip.file('project.json', readFileSync(FIXTURE_PATH));
  return {
    name: 'recovery-project.kk2d',
    mimeType: 'application/zip',
    buffer: await zip.generateAsync({ type: 'nodebuffer' }),
  };
}

async function loadProject(page) {
  await page.getByTitle('Load project').click();
  await page.locator('input[type="file"][accept=".kk2d"]').setInputFiles(await fixtureFile());
  const replace = page.getByRole('button', { name: 'Replace Workspace' });
  const skip = page.getByRole('button', { name: 'Skip' });
  await expect(replace.or(skip).first()).toBeVisible();
  if (await replace.isVisible()) {
    await replace.click();
    await expect(skip).toBeVisible();
  }
  await skip.click();
}

async function makeRecoverableEdit(page, value) {
  await page.getByRole('button', { name: 'Animation', exact: true }).click();
  await page.getByRole('button', { name: 'DRAW ORDER' }).click();
  await page.locator('span[title="Head"]').first().click();
  const frame = page.getByText('Frame', { exact: true }).locator('..').locator('input');
  await frame.fill('24');
  await frame.press('Enter');
  await page.getByTestId('transform-x').fill(String(value));
  await page.getByTestId('transform-x').blur();
  await expect(page.locator('[data-keyframe-address="node-1:x:1000"]')).toHaveCount(1);
  await expect(page.locator('[data-recovery-status="saved"]')).toBeAttached({ timeout: 10_000 });
}

test.describe('Workspace recovery', () => {
  test('restores latest dirty revision through project load pipeline', async ({ page }) => {
    await page.goto('/');
    await loadProject(page);
    await makeRecoverableEdit(page, 57);

    await page.reload();
    const prompt = page.locator('[data-recovery-prompt]');
    await expect(prompt).toBeVisible();
    await prompt.locator('[data-recovery-restore]').click();
    await expect(prompt).toHaveCount(0);

    await page.getByRole('button', { name: 'Animation', exact: true }).click();
    await page.getByRole('button', { name: 'DRAW ORDER' }).click();
    await page.locator('span[title="Head"]').first().click();
    await expect(page.locator('[data-keyframe-address="node-1:x:1000"]')).toHaveCount(1);
  });

  test('discard removes recovery and it does not return after reload', async ({ page }) => {
    await page.goto('/');
    await loadProject(page);
    await makeRecoverableEdit(page, 63);

    await page.reload();
    const prompt = page.locator('[data-recovery-prompt]');
    await expect(prompt).toBeVisible();
    await prompt.locator('[data-recovery-discard]').click();
    await expect(prompt).toHaveCount(0);
    await page.reload();
    await expect(page.locator('[data-recovery-prompt]')).toHaveCount(0);
  });
});
