import { describe, it, expect } from 'vitest';
import { screenToWorld, worldToLocal, clientToCanvasSpace } from '@/features/canvas/domain/coordinates.js';

describe('screenToWorld', () => {
  it('converts client coordinates using zoom and pan', () => {
    const view = { zoom: 2, panX: 10, panY: 20 };
    const rect = { left: 0, top: 0 };
    const [x, y] = screenToWorld({ clientX: 100, clientY: 200, rect, view });
    // cx = 100/2 - 10/2 = 45
    // cy = 200/2 - 20/2 = 90
    expect(x).toBeCloseTo(45);
    expect(y).toBeCloseTo(90);
  });

  it('handles non-zero rect offset', () => {
    const view = { zoom: 1, panX: 0, panY: 0 };
    const rect = { left: 50, top: 100 };
    const [x, y] = screenToWorld({ clientX: 100, clientY: 200, rect, view });
    expect(x).toBe(50);
    expect(y).toBe(100);
  });
});

describe('worldToLocal', () => {
  it('applies inverse matrix on identity (translation only)', () => {
    const identity = new Float32Array([1, 0, 0, 0, 1, 0, 5, 7, 1]);
    const [x, y] = worldToLocal(0, 0, identity);
    expect(x).toBeCloseTo(5);
    expect(y).toBeCloseTo(7);
  });

  it('returns same point for zero translation identity', () => {
    const identity = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    const [x, y] = worldToLocal(3, 4, identity);
    expect(x).toBeCloseTo(3);
    expect(y).toBeCloseTo(4);
  });
});

describe('clientToCanvasSpace', () => {
  it('delegates to screenToWorld using canvas.getBoundingClientRect', () => {
    const fakeCanvas = {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    };
    const view = { zoom: 1, panX: 0, panY: 0 };
    const [x, y] = clientToCanvasSpace(fakeCanvas, 100, 200, view);
    expect(x).toBe(100);
    expect(y).toBe(200);
  });
});
