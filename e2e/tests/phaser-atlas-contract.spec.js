import { test, expect } from '@playwright/test';

const HARNESS_URL = '/e2e/tests/phaser-atlas-contract.html';
const TIMEOUT = 15000;

async function waitForResults(page) {
  await page.waitForFunction(
    () => window.__PHASER_RESULTS && window.__PHASER_RESULTS.done === true,
    { timeout: TIMEOUT }
  );
  return page.evaluate(() => window.__PHASER_RESULTS);
}

test.describe('Phaser 4.2.1 atlas contract', () => {
  test('single atlas loads and animation plays', async ({ page }) => {
    await page.goto(HARNESS_URL);
    const results = await waitForResults(page);

    expect(results.errors).toEqual([]);
    expect(results.phaserVersion).toMatch(/^4\./);

    expect(results.single).not.toBeNull();
    expect(results.single.loaded).toBe(true);
    expect(results.single.frameNames).toEqual(['idle/0000', 'idle/0001']);
    expect(results.single.animationPlaying).toBe(true);
    expect(results.single.currentFrame).toBe('idle/0000');
  });

  test('multiatlas loads and animation plays', async ({ page }) => {
    await page.goto(HARNESS_URL);
    const results = await waitForResults(page);

    expect(results.errors).toEqual([]);

    expect(results.multi).not.toBeNull();
    expect(results.multi.loaded).toBe(true);
    expect(results.multi.frameNames).toEqual(['walk/0000', 'walk/0001', 'walk/0002']);
    expect(results.multi.animationPlaying).toBe(true);
    expect(results.multi.currentFrame).toBe('walk/0000');
    expect(results.multi.textureSourceCount).toBe(2);
  });

  test('animation advances frames over time', async ({ page }) => {
    await page.goto(HARNESS_URL);
    const results = await waitForResults(page);

    expect(results.single).not.toBeNull();
    expect(results.single.currentFrame).toBe('idle/0000');

    const nextFrame = await page.evaluate(async () => {
      const game = window.__PHASER_GAME;
      const scene = game.scene.getScene('MultiScene');
      if (!scene) {
        const activeScene = game.scene.getScenes(true)[0];
        const sprite = activeScene.children.list.find(
          c => c.type === 'Sprite' && c.anims && c.anims.isPlaying
        );
        if (!sprite) return null;
        await new Promise(r => setTimeout(r, 300));
        return sprite.frame.name;
      }
      const sprite = scene.children.list.find(
        c => c.type === 'Sprite' && c.anims && c.anims.isPlaying
      );
      if (!sprite) return null;
      await new Promise(r => setTimeout(r, 300));
      return sprite.frame.name;
    });

    expect(nextFrame).not.toBeNull();
  });
});
