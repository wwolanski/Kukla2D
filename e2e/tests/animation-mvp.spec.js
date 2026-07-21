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
    name: 'animation-mvp.kk2d',
    mimeType: 'application/zip',
    buffer: await zip.generateAsync({ type: 'nodebuffer' }),
  };
}

async function loadProjectFromUi(page, file = null) {
  page.on('console', message => {
    if (message.type() === 'error') console.error(`browser: ${message.text()}`);
  });
  await page.getByTitle('Load project').click();
  await expect(page.getByRole('heading', { name: 'Load Project' })).toBeVisible();
  await page.locator('input[type="file"][accept=".kk2d"]').setInputFiles(file ?? await fixtureFile());

  const replace = page.getByRole('button', { name: 'Replace Workspace' });
  const skip = page.getByRole('button', { name: 'Skip' });
  await expect(replace.or(skip).first()).toBeVisible();
  if (await replace.isVisible()) {
    await replace.click();
    await expect(skip).toBeVisible();
  }
  await skip.click();

  await expect(page.getByRole('button', { name: 'Animation', exact: true })).toBeVisible();
}

async function enterAnimationAndSelectHead(page) {
  await page.getByRole('button', { name: 'Animation', exact: true }).click();
  await expect(page.locator('p', { hasText: 'Walk' }).filter({ hasText: /^Walk$/ })).toBeVisible();
  await page.getByRole('button', { name: 'DRAW ORDER' }).click();
  await page.locator('span[title="Head"]').first().click();
  await expect(page.getByTestId('transform-x')).toBeVisible();
}

async function setFrame(page, frame) {
  const input = page.getByText('Frame', { exact: true }).locator('..').locator('input');
  await input.fill(String(frame));
  await input.press('Enter');
  await input.blur();
}

test.describe('Animation MVP E2E — public UI', () => {
  test('A1/A5: auto-key, property identity, undo/redo', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await loadProjectFromUi(page);
    await enterAnimationAndSelectHead(page);

    await setFrame(page, 24);
    await page.getByTestId('transform-x').fill('50');
    await page.getByTestId('transform-x').blur();

    const authored = page.locator('[data-keyframe-address="node-1:x:1000"]');
    await expect(page.getByText('Position', { exact: true })).toBeVisible();
    await expect(page.locator('[data-keyframe-group*="group:position"]')).toHaveCount(3);
    await expect(authored).toHaveCount(1);
    await expect(page.locator('[data-keyframe-address="node-1:opacity:0"]')).toHaveCount(1);

    await page.keyboard.press('Control+z');
    await expect(authored).toHaveCount(0);
    await page.keyboard.press('Control+y');
    await expect(authored).toHaveCount(1);
    expect(errors).toEqual([]);
  });

  test('A2: manual draft blocks navigation until discard', async ({ page }) => {
    await page.goto('/');
    await loadProjectFromUi(page);
    await enterAnimationAndSelectHead(page);

    await page.getByTitle(/Auto Keyframe:/).click();
    await page.getByTestId('transform-x').fill('33');
    await page.getByTestId('transform-x').blur();
    await expect(page.getByText('Pending draft', { exact: true })).toBeVisible();

    await setFrame(page, 12);
    const frameInput = page.getByText('Frame', { exact: true }).locator('..').locator('input');
    await expect(frameInput).toHaveValue('0');

    await page.getByRole('button', { name: 'Discard' }).click();
    await expect(page.getByText('Pending draft', { exact: true })).toHaveCount(0);
    await setFrame(page, 12);
    await expect(frameInput).toHaveValue('12');
  });

  test('A8/A9: save and reload preserves authored clip through file UI', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await loadProjectFromUi(page);
    await enterAnimationAndSelectHead(page);

    await setFrame(page, 24);
    await page.getByTestId('transform-y').fill('75');
    await page.getByTestId('transform-y').blur();
    await expect(page.locator('[data-keyframe-address="node-1:y:1000"]')).toHaveCount(1);

    await page.getByTitle('Save project').click();
    await page.getByRole('tab', { name: 'Download File' }).click();
    await page.getByLabel('Project Name').fill('animation-roundtrip');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    const download = await downloadPromise;
    const path = await download.path();
    expect(path).not.toBeNull();

    await loadProjectFromUi(page, {
      name: 'animation-roundtrip.kk2d',
      mimeType: 'application/zip',
      buffer: readFileSync(path),
    });
    await enterAnimationAndSelectHead(page);
    await expect(page.locator('[data-keyframe-address="node-1:y:1000"]')).toHaveCount(1);
    expect(errors).toEqual([]);
  });
});
