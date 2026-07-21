import { describe, expect, it } from 'vitest';
import {
  buildPoseHandle,
  buildRotatedBoneBranch,
  normalizeAngleDegrees,
  updatePoseHandleDrag,
} from '@/features/canvas/domain/poseHandle.js';

describe('pose handle', () => {
  it('starts at bone tip and preserves an extended precision radius', () => {
    const bone = {
      id: 'arm',
      setup: { x: 10, y: 20, rotation: 0, length: 40 },
    };
    const base = buildPoseHandle({ bone });
    const extended = buildPoseHandle({ bone, extension: 200 });

    expect(base.handle).toEqual({ x: 50, y: 20 });
    expect(extended.handle).toEqual({ x: 210, y: 20 });
    expect(extended.boneTip).toEqual({ x: 50, y: 20 });
  });

  it('uses radial movement for precision distance and tangential movement for rotation', () => {
    const radial = updatePoseHandleDrag({
      pivot: { x: 0, y: 0 },
      pointer: { x: 300, y: 0 },
      startRotation: 0,
      startPointerAngle: 0,
      minRadius: 50,
    });
    const rotated = updatePoseHandleDrag({
      pivot: { x: 0, y: 0 },
      pointer: { x: 0, y: 300 },
      startRotation: 0,
      startPointerAngle: 0,
      minRadius: 50,
    });

    expect(radial).toMatchObject({ radius: 300, rotation: 0 });
    expect(rotated.radius).toBe(300);
    expect(rotated.rotation).toBeCloseTo(90);
  });

  it('rotates descendants around root while preserving hierarchy shape', () => {
    const bones = [
      { id: 'upper', parentId: null, setup: { x: 0, y: 0, rotation: 0 } },
      { id: 'lower', parentId: 'upper', setup: { x: 100, y: 0, rotation: 0 } },
      { id: 'hand', parentId: 'lower', setup: { x: 150, y: 0, rotation: 0 } },
      { id: 'other', parentId: null, setup: { x: 5, y: 5, rotation: 10 } },
    ];
    const pose = buildRotatedBoneBranch(bones, 'upper', 90);

    expect(pose.get('upper')).toEqual({ rotation: 90 });
    expect(pose.get('lower').x).toBeCloseTo(0);
    expect(pose.get('lower').y).toBeCloseTo(100);
    expect(pose.get('hand').x).toBeCloseTo(0);
    expect(pose.get('hand').y).toBeCloseTo(150);
    expect(pose.has('other')).toBe(false);
  });

  it('normalizes wraparound rotation deltas', () => {
    expect(normalizeAngleDegrees(350)).toBe(-10);
    expect(normalizeAngleDegrees(-350)).toBe(10);
  });
});
