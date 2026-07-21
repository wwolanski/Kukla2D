import { describe, it, expect } from 'vitest';
import {
  computeZoomAtPoint,
  clampZoom,
  VIEWPORT_LIMITS,
  MIN_ZOOM,
  MAX_ZOOM,
} from '@/features/canvas/application/useViewportCommands.js';

describe('VIEWPORT_LIMITS', () => {
  it('exposes expected zoom bounds', () => {
    expect(VIEWPORT_LIMITS.ZOOM_FACTOR).toBe(1.1);
    expect(VIEWPORT_LIMITS.MIN_ZOOM).toBe(0.05);
    expect(VIEWPORT_LIMITS.MAX_ZOOM).toBe(20);
  });
});

describe('clampZoom', () => {
  it('clamps to MIN_ZOOM', () => {
    expect(clampZoom(0.001)).toBe(MIN_ZOOM);
  });
  it('clamps to MAX_ZOOM', () => {
    expect(clampZoom(100)).toBe(MAX_ZOOM);
  });
  it('passes through valid zoom', () => {
    expect(clampZoom(1.5)).toBe(1.5);
  });
});

describe('computeZoomAtPoint', () => {
  it('returns new view that anchors zoom at given client point', () => {
    const view = { zoom: 1, panX: 0, panY: 0 };
    const rect = { left: 0, top: 0 };
    const out = computeZoomAtPoint({ view, clientX: 100, clientY: 100, rect, deltaY: -100 });
    expect(out.zoom).toBeGreaterThan(1);
    // Anchor: world at (100,100) before zoom is (100,100) (zoom=1, pan=0).
    // After zoom, the same world point should still be at (100,100) on screen.
    const wx = (100 - rect.left - view.panX) / view.zoom;
    const wy = (100 - rect.top - view.panY) / view.zoom;
    const screenX = wx * out.zoom + out.panX;
    const screenY = wy * out.zoom + out.panY;
    expect(screenX).toBeCloseTo(100, 1);
    expect(screenY).toBeCloseTo(100, 1);
  });

  it('clamps zoom to [MIN_ZOOM, MAX_ZOOM]', () => {
    const rect = { left: 0, top: 0 };
    let view = { zoom: 1, panX: 0, panY: 0 };
    for (let i = 0; i < 50; i++) {
      view = computeZoomAtPoint({ view, clientX: 0, clientY: 0, rect, deltaY: -1 });
    }
    expect(view.zoom).toBeLessThanOrEqual(20);
    for (let i = 0; i < 100; i++) {
      view = computeZoomAtPoint({ view, clientX: 0, clientY: 0, rect, deltaY: 1 });
    }
    expect(view.zoom).toBeGreaterThanOrEqual(0.05);
  });

  it('zoom out: factor = 1/ZOOM_FACTOR', () => {
    const view = { zoom: 1, panX: 0, panY: 0 };
    const rect = { left: 0, top: 0 };
    const out = computeZoomAtPoint({ view, clientX: 0, clientY: 0, rect, deltaY: 100 });
    expect(out.zoom).toBeCloseTo(1 / 1.1, 5);
  });
});
