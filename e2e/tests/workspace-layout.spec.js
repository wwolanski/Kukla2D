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

const LAYOUT_WARN_PATTERNS = [
  /Invalid layout total size/i,
  /Panel id and order props recommended/i,
];

test.describe('Workspace Layout — no layout warnings', () => {
  test('staging mode has no layout warnings', async ({ page }) => {
    const warnings = [];
    page.on('console', (msg) => {
      if (msg.type() === 'warning') {
        const text = msg.text();
        if (LAYOUT_WARN_PATTERNS.some((p) => p.test(text))) {
          warnings.push(text);
        }
      }
    });

    await page.goto('/');
    await page.waitForTimeout(500);
    expect(warnings).toEqual([]);
  });

  test('animation mode has no layout warnings', async ({ page }) => {
    const warnings = [];
    page.on('console', (msg) => {
      if (msg.type() === 'warning') {
        const text = msg.text();
        if (LAYOUT_WARN_PATTERNS.some((p) => p.test(text))) {
          warnings.push(text);
        }
      }
    });

    await page.goto('/');
    await loadProjectFromUi(page);
    await page.getByRole('button', { name: 'Animation', exact: true }).click();
    await page.waitForTimeout(500);
    expect(warnings).toEqual([]);
  });

  test('transition staging -> animation has no layout warnings', async ({ page }) => {
    const warnings = [];
    page.on('console', (msg) => {
      if (msg.type() === 'warning') {
        const text = msg.text();
        if (LAYOUT_WARN_PATTERNS.some((p) => p.test(text))) {
          warnings.push(text);
        }
      }
    });

    await page.goto('/');
    await loadProjectFromUi(page);

    await page.getByRole('button', { name: 'Animation', exact: true }).click();
    await page.waitForTimeout(300);

    await page.getByRole('button', { name: 'Staging' }).click();
    await page.waitForTimeout(300);

    await page.getByRole('button', { name: 'Animation', exact: true }).click();
    await page.waitForTimeout(500);

    expect(warnings).toEqual([]);
  });
});
