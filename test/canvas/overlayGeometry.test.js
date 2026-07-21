import { describe, it, expect } from 'vitest';
import { toImage, arcPath, rotationHandlePoint } from '@/features/canvas/overlays/skeleton/skeletonGeometry.js';
import { nodeBounds, toScreen, rotationHandle } from '@/features/canvas/overlays/gizmo/gizmoGeometry.js';
import { latticeToScreen, gridLines, isCornerIdx } from '@/features/canvas/overlays/warp/warpLatticeGeometry.js';

describe('skeletonGeometry', () => {
  it('toImage converts world to image with zoom/pan', () => {
    const v = { zoom: 2, panX: 10, panY: 20 };
    const p = toImage(5, 5, v);
    expect(p).toEqual({ x: 20, y: 30 });
  });

  it('arcPath builds quadratic Bezier path', () => {
    const start = { x: 0, y: 0 };
    const end = { x: 10, y: 0 };
    const control = { x: 5, y: -5 };
    expect(arcPath(start, end, control)).toBe('M 0 0 Q 5 -5 10 0');
  });

  it('rotationHandlePoint is perpendicular to bone direction', () => {
    const start = { x: 0, y: 0 };
    const end = { x: 10, y: 0 };
    const h = rotationHandlePoint(start, end, 5);
    // (10,0) bone → perpendicular = (0,1); handle at end + 5*(0,1) = (10, 5)
    expect(h.x).toBeCloseTo(10);
    expect(h.y).toBeCloseTo(5);
  });
});

describe('gizmoGeometry', () => {
  it('nodeBounds uses imageBounds', () => {
    const node = { imageBounds: { minX: 10, minY: 20, maxX: 110, maxY: 120 } };
    expect(nodeBounds(node)).toEqual({ x: 10, y: 20, w: 100, h: 100 });
  });

  it('nodeBounds defaults to 0..1', () => {
    expect(nodeBounds({})).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it('toScreen applies zoom/pan', () => {
    expect(toScreen(5, 5, { zoom: 2, panX: 10, panY: 20 })).toEqual({ x: 20, y: 30 });
  });

  it('rotationHandle is above bbox center', () => {
    const b = { x: 0, y: 100, w: 100, h: 100 };
    const v = { zoom: 1, panX: 0, panY: 0 };
    const h = rotationHandle(b, v, 30);
    expect(h.x).toBe(50);
    expect(h.y).toBe(70); // 100 - 30/1
  });
});

describe('warpLatticeGeometry', () => {
  it('latticeToScreen applies zoom/pan', () => {
    expect(latticeToScreen({ x: 5, y: 5 }, { zoom: 2, panX: 10, panY: 20 })).toEqual({ x: 20, y: 30 });
  });

  it('gridLines produces row*col + (row+1)*col lines', () => {
    // col=2, row=1: 3 columns × 2 rows = 6 points
    // horizontal: row=0..1 × (col-1=1) = 2×2 = 4
    // vertical: (col+1=3) × row=1 = 3
    // total: 7
    const pts = Array.from({ length: 6 }, (_, i) => ({ x: i, y: 0 }));
    const lines = gridLines(pts, 2, 1);
    expect(lines).toHaveLength(7);
  });

  it('isCornerIdx identifies corner vertices', () => {
    expect(isCornerIdx(2, 2, 0, 0)).toBe(true);
    expect(isCornerIdx(2, 2, 2, 2)).toBe(true);
    expect(isCornerIdx(2, 2, 1, 0)).toBe(false);
    expect(isCornerIdx(2, 2, 1, 1)).toBe(false);
  });
});
