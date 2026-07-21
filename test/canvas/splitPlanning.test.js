import { describe, it, expect } from 'vitest';
import { applyLayerSplits } from '@/features/canvas/domain/import/splitPlanning.js';

describe('applyLayerSplits', () => {
  it('replaces a single layer with multiple pieces', () => {
    const layers = [{ name: 'A' }, { name: 'B' }];
    const partIds = ['p1', 'p2'];
    const splits = [{
      mergedIdx: 0,
      pieces: [{ name: 'A-L' }, { name: 'A-R' }],
    }];
    const { layers: out, partIds: outIds } = applyLayerSplits({ layers, partIds, splits, createId: () => 'newId' });
    expect(out).toHaveLength(3);
    expect(out[0].name).toBe('A-L');
    expect(out[1].name).toBe('A-R');
    expect(out[2].name).toBe('B');
    expect(outIds).toEqual(['newId', 'newId', 'p2']);
  });

  it('sorts splits descending by mergedIdx', () => {
    const layers = [{ name: 'A' }, { name: 'B' }, { name: 'C' }];
    const partIds = ['p1', 'p2', 'p3'];
    const splits = [
      { mergedIdx: 0, pieces: [{ name: 'A-L' }] },
      { mergedIdx: 2, pieces: [{ name: 'C-L' }] },
    ];
    const { layers: out } = applyLayerSplits({ layers, partIds, splits, createId: () => 'x' });
    // out[0] = A-L (from idx 0), then B, then C-L (from idx 2 originally → after splice idx 2)
    expect(out[0].name).toBe('A-L');
    expect(out[1].name).toBe('B');
    expect(out[2].name).toBe('C-L');
  });
});
