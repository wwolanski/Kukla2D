import { describe, it, expect } from 'vitest';
import { computeMoveDelta, computeRotationDelta, computePivotTransformPatch } from '@/features/canvas/domain/dragMath.js';

describe('computeMoveDelta', () => {
  it('computes delta divided by zoom', () => {
    const result = computeMoveDelta({
      startClientX: 100, startClientY: 200,
      currentClientX: 150, currentClientY: 250,
      zoom: 2,
    });
    expect(result.dx).toBe(25);
    expect(result.dy).toBe(25);
  });

  it('handles zoom = 1', () => {
    const result = computeMoveDelta({
      startClientX: 0, startClientY: 0,
      currentClientX: 30, currentClientY: 40,
      zoom: 1,
    });
    expect(result.dx).toBe(30);
    expect(result.dy).toBe(40);
  });

  it('handles negative movement', () => {
    const result = computeMoveDelta({
      startClientX: 200, startClientY: 200,
      currentClientX: 100, currentClientY: 50,
      zoom: 2,
    });
    expect(result.dx).toBe(-50);
    expect(result.dy).toBe(-75);
  });

  it('handles zoom = 0 (fallback to 1)', () => {
    const result = computeMoveDelta({
      startClientX: 0, startClientY: 0,
      currentClientX: 10, currentClientY: 20,
      zoom: 0,
    });
    expect(result.dx).toBe(10);
    expect(result.dy).toBe(20);
  });
});

describe('computeRotationDelta', () => {
  it('computes rotation delta in degrees', () => {
    const delta = computeRotationDelta({
      startAngle: 0,
      currentPoint: { x: 1, y: 0 },
      pivotPoint: { x: 0, y: 0 },
    });
    expect(delta).toBeCloseTo(0);
  });

  it('computes 90 degree rotation', () => {
    const delta = computeRotationDelta({
      startAngle: 0,
      currentPoint: { x: 0, y: 1 },
      pivotPoint: { x: 0, y: 0 },
    });
    expect(delta).toBeCloseTo(90);
  });

  it('computes negative rotation', () => {
    const delta = computeRotationDelta({
      startAngle: 0,
      currentPoint: { x: 0, y: -1 },
      pivotPoint: { x: 0, y: 0 },
    });
    expect(delta).toBeCloseTo(-90);
  });

  it('snaps to 15 degree increments when snap15 = true', () => {
    const angle10 = 10 * Math.PI / 180;
    const delta = computeRotationDelta({
      startAngle: 0,
      currentPoint: { x: Math.cos(angle10), y: Math.sin(angle10) },
      pivotPoint: { x: 0, y: 0 },
      snap15: true,
    });
    expect(delta).toBe(15);
  });

  it('does not snap when snap15 = false', () => {
    const delta = computeRotationDelta({
      startAngle: 0,
      currentPoint: { x: Math.cos(Math.PI / 6), y: Math.sin(Math.PI / 6) },
      pivotPoint: { x: 0, y: 0 },
      snap15: false,
    });
    expect(delta).toBeCloseTo(30);
  });

  it('snaps 37 degrees to 30 degrees', () => {
    const angle37 = 37 * Math.PI / 180;
    const delta = computeRotationDelta({
      startAngle: 0,
      currentPoint: { x: Math.cos(angle37), y: Math.sin(angle37) },
      pivotPoint: { x: 0, y: 0 },
      snap15: true,
    });
    expect(delta).toBe(30);
  });
});

describe('computePivotTransformPatch', () => {
  it('moves pivot without rotation', () => {
    const patch = computePivotTransformPatch({
      startPivotX: 10, startPivotY: 20,
      startX: 100, startY: 200,
      localDeltaX: 5, localDeltaY: 10,
      rotation: 0, scaleX: 1, scaleY: 1,
    });
    expect(patch.pivotX).toBe(15);
    expect(patch.pivotY).toBe(30);
    expect(patch.x).toBe(100);
    expect(patch.y).toBe(200);
  });

  it('compensates position when pivot moves with rotation', () => {
    const patch = computePivotTransformPatch({
      startPivotX: 0, startPivotY: 0,
      startX: 100, startY: 200,
      localDeltaX: 10, localDeltaY: 0,
      rotation: 90, scaleX: 1, scaleY: 1,
    });
    expect(patch.pivotX).toBe(10);
    expect(patch.pivotY).toBe(0);
    expect(patch.x).toBeCloseTo(90);
    expect(patch.y).toBeCloseTo(210);
  });

  it('handles scale in pivot transform', () => {
    const patch = computePivotTransformPatch({
      startPivotX: 0, startPivotY: 0,
      startX: 50, startY: 50,
      localDeltaX: 10, localDeltaY: 0,
      rotation: 0, scaleX: 2, scaleY: 3,
    });
    expect(patch.pivotX).toBe(10);
    expect(patch.x).toBe(50 + 10 * (2 - 1));
  });

  it('defaults rotation/scale to 0/1 if undefined', () => {
    const patch = computePivotTransformPatch({
      startPivotX: 0, startPivotY: 0,
      startX: 0, startY: 0,
      localDeltaX: 5, localDeltaY: 5,
      rotation: undefined, scaleX: undefined, scaleY: undefined,
    });
    expect(patch.pivotX).toBe(5);
    expect(patch.pivotY).toBe(5);
    expect(patch.x).toBeCloseTo(0 + 5 * (1 - 1) + 5 * 0);
    expect(patch.y).toBeCloseTo(0 + 5 * 0 + 5 * (1 - 1));
  });
});
