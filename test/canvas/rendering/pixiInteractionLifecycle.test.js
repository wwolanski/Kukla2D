import { afterEach, describe, expect, it, vi } from 'vitest';

import { bindPixiInteractionEvents } from '@/features/canvas/infrastructure/rendering/pixi/bindPixiInteractionEvents.js';

afterEach(() => vi.unstubAllGlobals());

describe('Pixi interaction lifecycle', () => {
  it('unbinds every Pixi and DOM listener once when disposed repeatedly', () => {
    const stage = { on: vi.fn(), off: vi.fn(), eventMode: 'none', hitArea: null };
    const browserWindow = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
    vi.stubGlobal('window', browserWindow);
    const handlers = {
      pointerDown: vi.fn(),
      pointerMove: vi.fn(),
      pointerUp: vi.fn(),
      pointerUpOutside: vi.fn(),
      pointerCancel: vi.fn(),
      pointerLeave: vi.fn(),
      windowBlur: vi.fn(),
    };
    const screen = { width: 640, height: 480 };

    const dispose = bindPixiInteractionEvents(stage, screen, handlers);
    dispose();
    dispose();

    expect(stage.eventMode).toBe('static');
    expect(stage.hitArea).toBe(screen);
    expect(stage.on).toHaveBeenCalledTimes(6);
    expect(stage.off).toHaveBeenCalledTimes(6);
    expect(browserWindow.addEventListener).toHaveBeenCalledWith('blur', handlers.windowBlur);
    expect(browserWindow.removeEventListener).toHaveBeenCalledTimes(1);
    expect(browserWindow.removeEventListener).toHaveBeenCalledWith('blur', handlers.windowBlur);
  });
});
