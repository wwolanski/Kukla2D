import { describe, it, expect } from 'vitest';
import { buildWarpKeyframes, buildRestGrid } from '@/features/canvas/domain/warpKeyframes.js';

describe('buildRestGrid', () => {
  it('produces a row-major flat grid', () => {
    const grid = buildRestGrid({ gridX: 0, gridY: 0, gridW: 10, gridH: 10, col: 2, row: 1 });
    expect(grid).toHaveLength(6);
    expect(grid[0]).toEqual({ x: 0, y: 0 });
    expect(grid[2]).toEqual({ x: 10, y: 0 });
    expect(grid[5]).toEqual({ x: 10, y: 10 });
  });
});

describe('buildWarpKeyframes', () => {
  const cases = [
    'face_angle_x', 'body_angle_x', 'neck_follow', 'face_angle_y',
    'body_angle_y', 'body_angle_z', 'eye_open', 'mouth_open',
    'brow_y', 'hair_sway', 'breathing',
  ];

  it.each(cases)('returns valid keyframes for %s', (warpType) => {
    const kf = buildWarpKeyframes(warpType, 0, 0, 100, 100, 2, 2, 1);
    expect(Array.isArray(kf)).toBe(true);
    expect(kf.length).toBeGreaterThanOrEqual(2);
    for (const k of kf) {
      expect(k).toHaveProperty('time');
      expect(k).toHaveProperty('value');
      expect(Array.isArray(k.value)).toBe(true);
    }
  });

  it('unknown warpType returns flat fallback (2 keyframes)', () => {
    const kf = buildWarpKeyframes('nonsense', 0, 0, 10, 10, 2, 2, 1);
    expect(kf).toHaveLength(2);
    expect(kf[0].time).toBe(0);
    expect(kf[1].time).toBe(1000);
  });

  it('scale < 1 reduces dx/dy amplitude', () => {
    const kf1 = buildWarpKeyframes('hair_sway', 0, 0, 10, 10, 1, 1, 1);
    const kf05 = buildWarpKeyframes('hair_sway', 0, 0, 10, 10, 1, 1, 0.5);
    // value[3] is (cn=1, rn=1) → rightSway produces dx = 1*1*0.20*10 = 2,
    // multiplied by scale: scale=1 → x=12, scale=0.5 → x=11.
    const right1 = kf1.find(k => k.time === 1000).value[3];
    const right05 = kf05.find(k => k.time === 1000).value[3];
    expect(Math.abs(right1.x - right05.x)).toBeGreaterThan(0.5);
  });
});
