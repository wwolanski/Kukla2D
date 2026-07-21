import { describe, expect, it } from 'vitest';
import {
  hasActiveCanvasElement,
  resolveVisibleHoverHit,
} from '@/domain/hoverPolicy.js';

describe('hoverPolicy', () => {
  it('recognizes selection and focused rig targets as active canvas elements', () => {
    expect(hasActiveCanvasElement({ selection: ['part-1'] })).toBe(true);
    expect(hasActiveCanvasElement({ selection: [], activeBoneId: 'bone-1' })).toBe(true);
    expect(hasActiveCanvasElement({ selection: [], activeConstraintId: 'ik-1' })).toBe(true);
    expect(hasActiveCanvasElement({ selection: [] })).toBe(false);
  });

  it('suppresses canvas hover when an element is active', () => {
    expect(resolveVisibleHoverHit({
      selection: ['part-2'],
      hoverHit: 'part-1',
      hoverSource: 'canvas',
    })).toBeNull();
  });

  it('always preserves explicit panel hover', () => {
    expect(resolveVisibleHoverHit({
      selection: ['part-2'],
      activeBoneId: 'bone-1',
      hoverHit: 'part-1',
      hoverSource: 'panel',
    })).toBe('part-1');
  });
});
