// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('PixiAppLifecycle', () => {
  afterEach(() => {
    vi.doUnmock('pixi.js');
    vi.resetModules();
  });

  it('destroys an app whose async initialization finishes after disposal', async () => {
    let finishInitialization;
    const initialization = new Promise((resolve) => {
      finishInitialization = resolve;
    });
    const destroy = vi.fn();

    vi.resetModules();
    vi.doMock('pixi.js', () => ({
      Application: class {
        init() { return initialization; }
        destroy(...args) { destroy(...args); }
      },
    }));

    const { PixiAppLifecycle } = await import(
      '@/features/canvas/infrastructure/rendering/pixi/PixiAppLifecycle.js'
    );
    const lifecycle = new PixiAppLifecycle({
      canvas: { parentElement: null },
    });

    lifecycle.dispose();
    finishInitialization();
    await lifecycle.ready;

    expect(lifecycle.app).toBeNull();
    expect(destroy).toHaveBeenCalledOnce();
    expect(destroy).toHaveBeenCalledWith(
      { removeView: false },
      { children: true },
    );
  });

  it('releases a partially initialized app when initialization fails', async () => {
    const destroy = vi.fn();

    vi.resetModules();
    vi.doMock('pixi.js', () => ({
      Application: class {
        init() { return Promise.reject(new Error('WebGL unavailable')); }
        destroy(...args) { destroy(...args); }
      },
    }));

    const { PixiAppLifecycle } = await import(
      '@/features/canvas/infrastructure/rendering/pixi/PixiAppLifecycle.js'
    );
    const lifecycle = new PixiAppLifecycle({ canvas: { parentElement: null } });

    await expect(lifecycle.ready).rejects.toThrow('WebGL unavailable');
    expect(lifecycle.app).toBeNull();
    expect(destroy).toHaveBeenCalledOnce();
  });
});
