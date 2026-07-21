import { describe, it, expect } from 'vitest';
import * as CanvasFeature from '@/features/canvas/index.js';

describe('canvas feature API baseline', () => {
  it('feature module imports without throwing', () => {
    expect(CanvasFeature).toBeDefined();
  });

  it('exposes default export and named CanvasViewport after Stage 2', () => {
    expect(typeof CanvasFeature.default).toBe('function');
    expect(typeof CanvasFeature.CanvasViewport).toBe('function');
    // Same object in both exports.
    expect(CanvasFeature.default).toBe(CanvasFeature.CanvasViewport);
  });
});
