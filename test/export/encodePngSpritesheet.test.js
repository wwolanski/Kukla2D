// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encodePngSpritesheet } from '@/features/export/infrastructure/encodePngSpritesheet';

describe('encodePngSpritesheet', () => {
  let originalCreateImageBitmap;
  let originalFetch;
  let createElementSpy;
  let context;

  beforeEach(() => {
    originalCreateImageBitmap = globalThis.createImageBitmap;
    originalFetch = globalThis.fetch;
    context = { clearRect: vi.fn(), drawImage: vi.fn() };
    const originalCreateElement = document.createElement.bind(document);
    createElementSpy = vi.spyOn(document, 'createElement').mockImplementation(tag => {
      if (tag !== 'canvas') return originalCreateElement(tag);
      return {
        width: 0,
        height: 0,
        getContext: vi.fn(() => context),
        toBlob: vi.fn(callback => callback(new Blob(['png'], { type: 'image/png' }))),
      };
    });
    globalThis.fetch = vi.fn(async () => ({ blob: async () => new Blob(['frame'], { type: 'image/png' }) }));
    globalThis.createImageBitmap = vi.fn(async () => ({ close: vi.fn() }));
  });

  afterEach(() => {
    createElementSpy.mockRestore();
    globalThis.createImageBitmap = originalCreateImageBitmap;
    globalThis.fetch = originalFetch;
  });

  it('packs frames row-major and emits one PNG artifact', async () => {
    const frames = Array.from({ length: 5 }, (_, frameIndex) => ({
      frameIndex,
      width: 10,
      height: 20,
      dataUrl: `data:image/png,${frameIndex}`,
    }));
    const result = await encodePngSpritesheet({
      frames,
      area: { outputWidth: 10, outputHeight: 20 },
      animationName: 'walk cycle',
      spriteSheet: { columns: 3 },
    });

    expect(result).toHaveLength(1);
    expect(result[0].fileName).toBe('walk_cycle.png');
    expect(result[0].mimeType).toBe('image/png');
    expect(result[0].metadata).toEqual({
      frameWidth: 10,
      frameHeight: 20,
      columns: 3,
      rows: 2,
      frameCount: 5,
    });
    expect(context.drawImage.mock.calls.map(call => call.slice(1))).toEqual([
      [0, 0, 10, 20],
      [10, 0, 10, 20],
      [20, 0, 10, 20],
      [0, 20, 10, 20],
      [10, 20, 10, 20],
    ]);
  });

  it('rejects frames with inconsistent dimensions', async () => {
    await expect(encodePngSpritesheet({
      frames: [{ frameIndex: 0, width: 9, height: 20, dataUrl: 'data:image/png,x' }],
      area: { outputWidth: 10, outputHeight: 20 },
      spriteSheet: { columns: 1 },
    })).rejects.toThrow('dimensions 9x20 do not match plan 10x20');
  });
});
