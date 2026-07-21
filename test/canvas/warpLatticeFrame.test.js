// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { buildWarpLatticeFrame } from '@/features/canvas/domain/warpLatticeFrame.js';

describe('buildWarpLatticeFrame', () => {
  it('returns invisible frame when no wdNode', () => {
    const frame = buildWarpLatticeFrame({ wdNode: null, gridPoints: [] });
    expect(frame.visible).toBe(false);
    expect(frame.gridPoints).toHaveLength(0);
  });

  it('returns invisible frame when no gridPoints', () => {
    const frame = buildWarpLatticeFrame({
      wdNode: { col: 2, row: 2 },
      gridPoints: [],
    });
    expect(frame.visible).toBe(false);
  });

  it('computes grid params from wdNode', () => {
    const gridPoints = [
      { x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 },
      { x: 0, y: 50 }, { x: 50, y: 50 }, { x: 100, y: 50 },
      { x: 0, y: 100 }, { x: 50, y: 100 }, { x: 100, y: 100 },
    ];
    const frame = buildWarpLatticeFrame({
      wdNode: { col: 2, row: 2 },
      gridPoints,
    });
    expect(frame.visible).toBe(true);
    expect(frame.col).toBe(2);
    expect(frame.row).toBe(2);
    expect(frame.stride).toBe(3);
    expect(frame.gridPoints).toHaveLength(9);
  });

  it('clones grid points (does not mutate)', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 10 }];
    const frame = buildWarpLatticeFrame({ wdNode: { col: 1, row: 1 }, gridPoints: pts });
    expect(frame.gridPoints[0]).not.toBe(pts[0]);
    expect(frame.gridPoints[0]).toEqual(pts[0]);
  });

  it('defaults col/row to 2', () => {
    const pts = Array.from({ length: 9 }, (_, i) => ({ x: i, y: i }));
    const frame = buildWarpLatticeFrame({ wdNode: {}, gridPoints: pts });
    expect(frame.col).toBe(2);
    expect(frame.row).toBe(2);
    expect(frame.stride).toBe(3);
  });
});
