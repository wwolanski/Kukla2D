// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { applyNodeTransformToPixiDisplayObject } from '@/features/canvas/infrastructure/rendering/pixi/pixiTransform.js';

function createMockDisplayObject() {
  return {
    position: { x: 0, y: 0 },
    rotation: 0,
    scale: { x: 1, y: 1 },
    pivot: { x: 0, y: 0 },
  };
}

describe('pixiTransform mapping', () => {
  it('applies full transform with rotation in degrees', () => {
    const obj = createMockDisplayObject();
    applyNodeTransformToPixiDisplayObject(obj, {
      x: 10,
      y: 20,
      rotation: 90,
      scaleX: 2,
      scaleY: 3,
      pivotX: 5,
      pivotY: 6,
    });

    expect(obj.position.x).toBe(15);
    expect(obj.position.y).toBe(26);
    expect(obj.rotation).toBe(Math.PI / 2);
    expect(obj.scale.x).toBe(2);
    expect(obj.scale.y).toBe(3);
    expect(obj.pivot.x).toBe(5);
    expect(obj.pivot.y).toBe(6);
  });

  it('applies defaults for missing fields', () => {
    const obj = createMockDisplayObject();
    applyNodeTransformToPixiDisplayObject(obj, {});

    expect(obj.position.x).toBe(0);
    expect(obj.position.y).toBe(0);
    expect(obj.rotation).toBe(0);
    expect(obj.scale.x).toBe(1);
    expect(obj.scale.y).toBe(1);
    expect(obj.pivot.x).toBe(0);
    expect(obj.pivot.y).toBe(0);
  });

  it('handles null transform', () => {
    const obj = createMockDisplayObject();
    applyNodeTransformToPixiDisplayObject(obj, null);

    expect(obj.position.x).toBe(0);
    expect(obj.position.y).toBe(0);
    expect(obj.rotation).toBe(0);
    expect(obj.scale.x).toBe(1);
    expect(obj.scale.y).toBe(1);
  });

  it('converts 180 degrees rotation correctly', () => {
    const obj = createMockDisplayObject();
    applyNodeTransformToPixiDisplayObject(obj, { rotation: 180 });

    expect(obj.rotation).toBeCloseTo(Math.PI);
  });

  it('converts 45 degrees rotation correctly', () => {
    const obj = createMockDisplayObject();
    applyNodeTransformToPixiDisplayObject(obj, { rotation: 45 });

    expect(obj.rotation).toBeCloseTo(Math.PI / 4);
  });

  it('maps project x/y to Pixi pivot world position', () => {
    const obj = createMockDisplayObject();
    applyNodeTransformToPixiDisplayObject(obj, {
      x: 10,
      y: 20,
      pivotX: 100,
      pivotY: 50,
    });

    expect(obj.position).toEqual({ x: 110, y: 70 });
    expect(obj.pivot).toEqual({ x: 100, y: 50 });
  });
});
