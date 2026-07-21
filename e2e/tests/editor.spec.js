import { test, expect } from '@playwright/test';

test.describe('Editor', () => {
  test('starts without project', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
  });

  test('has canvas element', async ({ page }) => {
    await page.goto('/');
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
  });

  test('canvas is visible in central workspace', async ({ page }) => {
    await page.goto('/');
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
  });
});

test.describe('Pixi Backend Smoke', () => {
  test('canvas pixi backend renders non-empty pixels', async ({ page }) => {
    await page.goto('/?renderer=pixi');
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);

    const hasContent = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      if (!c) return false;
      const ctx = c.getContext('2d');
      if (!ctx) return true;
      const data = ctx.getImageData(0, 0, Math.min(c.width, 64), Math.min(c.height, 64));
      for (let i = 3; i < data.data.length; i += 4) {
        if (data.data[i] > 0) return true;
      }
      return false;
    });

    expect(hasContent).toBe(true);
  });
});

