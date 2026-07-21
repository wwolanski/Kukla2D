import { test, expect } from '@playwright/test';

const HARNESS_URL = '/e2e/tests/phaser-atlas-export.html';
const TIMEOUT = 30000;

async function waitForResults(page) {
  await page.waitForFunction(() => window.__EXPORT_DONE === true, { timeout: TIMEOUT });
  return page.evaluate(() => window.__EXPORT_RESULTS);
}

test.describe('Phaser atlas export E2E', () => {
  test('single atlas: adapter artifacts load and play in Phaser', async ({ page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error') console.error('BROWSER ERR:', msg.text());
    });

    await page.goto(HARNESS_URL);
    const r = await waitForResults(page);

    expect(r.errors).toEqual([]);
    expect(r.phaserVersion).toMatch(/^4\./);

    expect(r.single).not.toBeNull();
    expect(r.single.ok).toBe(true);
    expect(r.single.artifacts).toBe(7);
    expect(r.single.pages).toBe(1);
    expect(r.single.names).toEqual([
      'idle-a-idle/0000', 'idle-a-idle/0001', 'idle-a-idle/0002',
      'walk-a-walk/0000', 'walk-a-walk/0001',
    ]);
    expect(r.single.keys).toContain('golden-char:idle');
    expect(r.single.keys).toContain('golden-char:walk');
    expect(r.single.repeat).toBe(-1);
    expect(r.single.idlePlay).toBe(true);
    expect(r.single.walkPlay).toBe(true);
    expect(r.single.srcCount).toBe(1);
    expect(r.single.originDiffs).toEqual([0, 0, 0]);

    const regions = r.single.regions;
    expect(regions['idle-a-idle/0000'].ss).toEqual({ w: 64, h: 64 });
    expect(regions['idle-a-idle/0000'].trimmed).toBe(true);
    expect(regions['idle-a-idle/0000'].sss.x).toBeGreaterThan(0);
    expect(regions['idle-a-idle/0001'].frame.w).toBe(1);
    expect(regions['idle-a-idle/0001'].frame.h).toBe(1);
  });

  test('multi atlas: forced multi-page via small maxPageSize', async ({ page }) => {
    await page.goto(HARNESS_URL);
    const r = await waitForResults(page);

    expect(r.errors).toEqual([]);
    expect(r.multi).not.toBeNull();
    expect(r.multi.ok).toBe(true);
    expect(r.multi.isMulti).toBe(true);
    expect(r.multi.pageCount).toBeGreaterThanOrEqual(2);
    expect(r.multi.hasTextures).toBe(true);
    expect(r.multi.loadedFrames).toBe(5);
    expect(r.multi.walkPlay).toBe(true);
    expect(r.multi.loaderErrors).toEqual([]);
  });

  test('determinism: two runs produce identical output', async ({ page }) => {
    await page.goto(HARNESS_URL);
    const r = await waitForResults(page);

    expect(r.errors).toEqual([]);
    expect(r.determinism).not.toBeNull();
    expect(r.determinism.ok).toBe(true);
    expect(r.determinism.allText).toBe(true);
    expect(r.determinism.allPng).toBe(true);
  });

  test('metadata: markers, report, example, README correct', async ({ page }) => {
    await page.goto(HARNESS_URL);
    const r = await waitForResults(page);

    expect(r.errors).toEqual([]);
    expect(r.metadata).not.toBeNull();
    expect(r.metadata.ok).toBe(true);
    expect(r.metadata.markers).toBe(2);
    expect(r.metadata.labels).toContain('start');
    expect(r.metadata.labels).toContain('step');
    expect(r.metadata.format).toBe('phaser-atlas-baked');
    expect(r.metadata.issues).toBeGreaterThanOrEqual(1);
    expect(r.metadata.hasEx).toBe(true);
    expect(r.metadata.exLoad).toBe(true);
    expect(r.metadata.hasRm).toBe(true);
    expect(r.metadata.rmPhaser).toBe(true);

    const paths = r.metadata.paths;
    expect(paths.some(p => p.endsWith('.png'))).toBe(true);
    expect(paths.some(p => p.endsWith('.atlas.json'))).toBe(true);
    expect(paths.some(p => p.endsWith('.animations.json'))).toBe(true);
    expect(paths.some(p => p.endsWith('.markers.json'))).toBe(true);
    expect(paths.some(p => p.endsWith('.export-report.json'))).toBe(true);
    expect(paths.some(p => p.endsWith('.example.ts'))).toBe(true);
    expect(paths.some(p => p.endsWith('README.md'))).toBe(true);
  });

  test('existing contract fixtures still load in Phaser', async ({ page }) => {
    await page.goto('/e2e/tests/phaser-atlas-contract.html');
    const results = await page.waitForFunction(
      () => window.__PHASER_RESULTS && window.__PHASER_RESULTS.done === true,
      { timeout: 15000 }
    ).then(() => page.evaluate(() => window.__PHASER_RESULTS));

    expect(results.errors).toEqual([]);
    expect(results.phaserVersion).toMatch(/^4\./);
    expect(results.single.loaded).toBe(true);
    expect(results.multi.loaded).toBe(true);
  });
});
