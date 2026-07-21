import { describe, expect, it, vi } from 'vitest';
import { suppressPassiveCanvasHover } from '@/features/canvas/infrastructure/rendering/pixi/PixiHoverPolicy.js';

describe('PixiHoverPolicy', () => {
  it('allows passive canvas hover when no element is active', () => {
    const adapter = { _executeCommand: vi.fn(), markDirty: vi.fn() };

    expect(suppressPassiveCanvasHover(adapter, { selection: [] })).toBe(false);
    expect(adapter._executeCommand).not.toHaveBeenCalled();
  });

  it('clears canvas-owned hover when an element becomes active', () => {
    const adapter = { _executeCommand: vi.fn(), markDirty: vi.fn() };

    expect(suppressPassiveCanvasHover(adapter, {
      selection: ['part-2'],
      hoverHit: 'part-1',
      hoverSource: 'canvas',
    })).toBe(true);
    expect(adapter._executeCommand).toHaveBeenCalledWith({
      type: 'setHover',
      payload: { hit: null },
    });
    expect(adapter.markDirty).toHaveBeenCalledOnce();
  });

  it('never clears explicit panel hover', () => {
    const adapter = { _executeCommand: vi.fn(), markDirty: vi.fn() };

    expect(suppressPassiveCanvasHover(adapter, {
      selection: ['part-2'],
      hoverHit: 'part-1',
      hoverSource: 'panel',
    })).toBe(true);
    expect(adapter._executeCommand).not.toHaveBeenCalled();
  });
});
