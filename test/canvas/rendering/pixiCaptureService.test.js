// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { PixiCaptureService } from '@/features/canvas/infrastructure/rendering/pixi/PixiCaptureService.js';

describe('PixiCaptureService', () => {
  it('restores renderer and viewport dimensions when pixel read fails', () => {
    const renderer = {
      width: 800,
      height: 600,
      resize: vi.fn(),
      gl: {
        RGBA: 0x1908,
        UNSIGNED_BYTE: 0x1401,
        readPixels: vi.fn(() => { throw new Error('GPU read failed'); }),
      },
    };
    const app = { renderer, render: vi.fn() };
    const viewportBridge = { resize: vi.fn() };
    const service = new PixiCaptureService({ app, viewportBridge });

    expect(() => service.capture({ width: 320, height: 240 }))
      .toThrow('GPU read failed');
    expect(renderer.resize).toHaveBeenNthCalledWith(1, 320, 240);
    expect(renderer.resize).toHaveBeenNthCalledWith(2, 800, 600);
    expect(viewportBridge.resize).toHaveBeenCalledWith(800, 600);
    expect(app.render).toHaveBeenCalledTimes(2);
  });
});
