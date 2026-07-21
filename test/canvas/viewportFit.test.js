import { describe, expect, it } from 'vitest';
import {
  computeViewportFit,
  MAX_VIEWPORT_ZOOM,
  MIN_VIEWPORT_ZOOM,
} from '@/features/canvas/application/viewportFit.js';

describe('computeViewportFit', () => {
  it('fits image bounds with padding and centers their midpoint', () => {
    expect(computeViewportFit({
      viewportWidth: 400,
      viewportHeight: 300,
      parts: [{ type: 'part', imageBounds: { minX: 100, minY: 50, maxX: 300, maxY: 150 } }],
      fallbackWidth: 0,
      fallbackHeight: 0,
    })).toEqual({ zoom: 400 / 264, panX: 200 - 200 * (400 / 264), panY: 150 - 100 * (400 / 264) });
  });

  it('uses fallback dimensions and clamps zoom', () => {
    expect(computeViewportFit({ viewportWidth: 1, viewportHeight: 1, parts: [], fallbackWidth: 1000, fallbackHeight: 1000 })?.zoom)
      .toBe(MIN_VIEWPORT_ZOOM);
    expect(computeViewportFit({ viewportWidth: 100000, viewportHeight: 100000, parts: [], fallbackWidth: 1, fallbackHeight: 1 })?.zoom)
      .toBe(MAX_VIEWPORT_ZOOM);
  });
});
