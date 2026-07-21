import { describe, it, expect } from 'vitest';
import { createBakeKeyframes } from '../../src/domain/autoMotion/modifierBake.js';

function makeModifier(overrides = {}) {
  return {
    id: 'm1',
    name: 'Idle Breathing',
    presetId: 'builtin.idleBreathing',
    presetVersion: 1,
    enabled: true,
    order: 0,
    scope: 'project',
    category: 'loop',
    driver: { kind: 'time', periodMs: 2400, phase: 0, curve: 'easeInOutSine' },
    bindings: {},
    outputs: [{ kind: 'blendShapeValue', targetId: 'chest-1', property: 'bs1', blendMode: 'add' }],
    params: { strength: 1, bs1: 1 },
    ...overrides,
  };
}

function makeClip(overrides = {}) {
  return { id: 'anim-1', name: 'Idle', duration: 4800, fps: 24, tracks: [], ...overrides };
}

describe('createBakeKeyframes', () => {
  it('returns empty array for null modifier', () => {
    expect(createBakeKeyframes({ modifier: null, clip: makeClip() })).toEqual([]);
  });

  it('returns empty array for null clip', () => {
    expect(createBakeKeyframes({ modifier: makeModifier(), clip: null })).toEqual([]);
  });

  it('returns empty array for non-time driver', () => {
    const mod = makeModifier({ driver: { kind: 'reaction' } });
    expect(createBakeKeyframes({ modifier: mod, clip: makeClip() })).toEqual([]);
  });

  it('returns empty array for no outputs', () => {
    const mod = makeModifier({ outputs: [] });
    expect(createBakeKeyframes({ modifier: mod, clip: makeClip() })).toEqual([]);
  });

  it('creates 5 keyframes per cycle for blendShapeValue output', () => {
    const clip = makeClip({ duration: 2400 });
    const frames = createBakeKeyframes({ modifier: makeModifier(), clip });
    expect(frames.length).toBe(5);
    expect(frames[0]).toMatchObject({ targetId: 'chest-1', property: 'blendShape:bs1', easing: 'ease-both' });
    expect(frames[0].timeMs).toBe(0);
    expect(frames[1].timeMs).toBe(600);
    expect(frames[2].timeMs).toBe(1200);
    expect(frames[3].timeMs).toBe(1800);
    expect(frames[4].timeMs).toBe(2400);
  });

  it('repeats cycles to fill clip duration', () => {
    const clip = makeClip({ duration: 4800 });
    const frames = createBakeKeyframes({ modifier: makeModifier(), clip });
    expect(frames.length).toBe(10);
    expect(frames[0].timeMs).toBe(0);
    expect(frames[5].timeMs).toBe(2400);
    expect(frames[9].timeMs).toBe(4800);
  });

  it('clamps to clip duration', () => {
    const clip = makeClip({ duration: 3000 });
    const frames = createBakeKeyframes({ modifier: makeModifier({ driver: { kind: 'time', periodMs: 2400, phase: 0, curve: 'sine' } }), clip });
    const times = frames.map(f => f.timeMs);
    expect(Math.max(...times)).toBeLessThanOrEqual(3000);
    expect(times).toEqual(expect.arrayContaining([0, 600, 1200, 1800]));
  });

  it('creates nodeTransform keyframes with channel properties', () => {
    const mod = makeModifier({
      outputs: [{ kind: 'nodeTransform', targetId: 'chest-1', property: 'y' }],
      params: { strength: 1, verticalLiftPx: 10 },
    });
    const clip = makeClip({ duration: 2400 });
    const frames = createBakeKeyframes({ modifier: mod, clip });
    expect(frames.every(f => f.targetId === 'chest-1')).toBe(true);
    expect(frames.every(f => f.property === 'y')).toBe(true);
    expect(frames[0].value).toBe(0); // at t=0, sine starts at 0
    expect(Math.max(...frames.map(f => f.value))).toBeGreaterThan(8);
  });

  it('skips unsupported output kinds', () => {
    const mod = makeModifier({
      outputs: [
        { kind: 'meshDelta', targetId: 'chest-1', property: '', blendMode: 'add' },
        { kind: 'blendShapeValue', targetId: 'chest-1', property: 'bs1', blendMode: 'add' },
      ],
      params: { strength: 1, bs1: 1 },
    });
    const clip = makeClip({ duration: 2400 });
    const frames = createBakeKeyframes({ modifier: mod, clip });
    expect(frames.length).toBe(5);
    expect(frames.every(f => f.property === 'blendShape:bs1')).toBe(true);
  });

  it('blendShape values are bounded 0..1', () => {
    const mod = makeModifier({
      driver: { kind: 'time', periodMs: 2400, phase: 0, curve: 'sine' },
      params: { strength: 2, bs1: 2 },
    });
    const clip = makeClip({ duration: 2400 });
    const frames = createBakeKeyframes({ modifier: mod, clip });
    for (const f of frames) {
      expect(f.value).toBeGreaterThanOrEqual(0);
      expect(f.value).toBeLessThanOrEqual(1);
    }
  });

  it('applies strength parameter', () => {
    const mod = makeModifier({
      driver: { kind: 'time', periodMs: 2400, phase: 0, curve: 'sine' },
      params: { strength: 0.5, bs1: 1 },
    });
    const clip = makeClip({ duration: 2400 });
    const frames = createBakeKeyframes({ modifier: mod, clip });
    const maxVal = Math.max(...frames.map(f => f.value));
    expect(maxVal).toBeLessThanOrEqual(0.5);
  });

  it('bake getTransformAmount respects literal verticalLiftPx (no min 10)', () => {
    const mod = makeModifier({
      outputs: [{ kind: 'nodeTransform', targetId: 'chest-1', property: 'y' }],
      params: { strength: 1, verticalLiftPx: 2 },
    });
    const clip = makeClip({ duration: 2400 });
    const frames = createBakeKeyframes({ modifier: mod, clip });
    const maxVal = Math.max(...frames.map(f => f.value));
    expect(maxVal).toBeGreaterThan(0);
    expect(maxVal).toBeLessThan(3);
  });

  it('boneTransform output creates bone property keyframes', () => {
    const mod = makeModifier({
      outputs: [{ kind: 'boneTransform', targetId: 'bone-1', property: 'rotation' }],
      params: { strength: 1, rotation: 15 },
    });
    const clip = makeClip({ duration: 2400 });
    const frames = createBakeKeyframes({ modifier: mod, clip });
    expect(frames.length).toBe(5);
    expect(frames.every(f => f.targetId === 'bone-1')).toBe(true);
    expect(frames.every(f => f.property === 'rotation')).toBe(true);
  });

  it('returns empty for zero/invalid period', () => {
    const mod = makeModifier({ driver: { kind: 'time', periodMs: 0, phase: 0, curve: 'sine' } });
    expect(createBakeKeyframes({ modifier: mod, clip: makeClip() })).toEqual([]);
  });
});
