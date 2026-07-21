import { describe, it, expect } from 'vitest';
import { applyHistoricalClipToPartId } from '../src/io/psdOrganizer.js';

function makePart(id, name, extra = {}) {
  return {
    id,
    type: 'part',
    name,
    parent: null,
    draw_order: 0,
    opacity: 1,
    visible: true,
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
    ...extra,
  };
}

describe('applyHistoricalClipToPartId', () => {
  it('adds clipping only for unique historical pairs', () => {
    const result = applyHistoricalClipToPartId([
      makePart('white-center', 'eyewhite'),
      makePart('iris-center', 'irides'),
      makePart('white-left', 'eyewhite-l'),
      makePart('iris-left', 'irides-l'),
      makePart('iris-right', 'irides-r'),
    ]);

    expect(result.find((node) => node.id === 'iris-center')?.clipToPartId).toBe('white-center');
    expect(result.find((node) => node.id === 'iris-left')?.clipToPartId).toBe('white-left');
    expect(result.find((node) => node.id === 'iris-right')?.clipToPartId).toBeUndefined();
  });

  it('keeps ambiguous or explicit relations unchanged', () => {
    const result = applyHistoricalClipToPartId([
      makePart('white-a', 'eyewhite-r'),
      makePart('white-b', 'eyewhite-r 2'),
      makePart('iris-r', 'irides-r'),
      makePart('iris-explicit', 'irides', { clipToPartId: 'manual-target' }),
      makePart('white-center', 'eyewhite'),
    ]);

    expect(result.find((node) => node.id === 'iris-r')?.clipToPartId).toBeUndefined();
    expect(result.find((node) => node.id === 'iris-explicit')?.clipToPartId).toBe('manual-target');
  });
});
