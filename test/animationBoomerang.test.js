import { describe, it, expect } from 'vitest';
import {
  getTargetAuthoredEndMs,
  checkBoomerangEligibility,
  getBoomerangCutoff,
  checkBoomerangTimeBlocked,
  getBoomerangSourceTime,
} from '../src/domain/animationBoomerang.js';
import { computePoseOverrides } from '../src/domain/animationEngine.js';
import { expandAnimationForExport } from '../src/domain/animationExportBoomerang.js';

function makeAnim(opts = {}) {
  return {
    id: 'anim-1',
    name: 'Test',
    duration: opts.duration ?? 2000,
    fps: opts.fps ?? 30,
    tracks: opts.tracks ?? [],
    boomerangTargets: opts.boomerangTargets ?? undefined,
  };
}

function simpleTrack(targetId, property, keyframes) {
  return { targetId, property, keyframes };
}

function kf(time, value, easing = 'linear') {
  return { time, value, easing };
}

// ── getBoomerangSourceTime ──────────────────────────────────────────────────

describe('getBoomerangSourceTime', () => {
  it('returns time unchanged when no boomerang on target', () => {
    const anim = makeAnim({ duration: 2000 });
    const result = getBoomerangSourceTime(anim, 'node1', 500);
    expect(result).toEqual({ mappedTimeMs: 500, isGeneratedZone: false });
  });

  it('returns time unchanged for source zone (t <= sourceEndMs)', () => {
    const anim = makeAnim({
      duration: 2000,
      boomerangTargets: { node1: { sourceEndMs: 1400 } },
    });
    expect(getBoomerangSourceTime(anim, 'node1', 0)).toEqual({ mappedTimeMs: 0, isGeneratedZone: false });
    expect(getBoomerangSourceTime(anim, 'node1', 700)).toEqual({ mappedTimeMs: 700, isGeneratedZone: false });
    expect(getBoomerangSourceTime(anim, 'node1', 1400)).toEqual({ mappedTimeMs: 1400, isGeneratedZone: false });
  });

  it('maps generated zone time according to R5 formula', () => {
    const anim = makeAnim({
      duration: 2000,
      boomerangTargets: { node1: { sourceEndMs: 1400 } },
    });
    // At t = sourceEndMs = 1400: mappedTimeMs = 1400 (seam)
    // At t = duration = 2000: mappedTimeMs = 0 (end)
    // At t = 1700: mappedTimeMs = 1400 * (2000-1700)/(2000-1400) = 1400*300/600 = 700
    const seam = getBoomerangSourceTime(anim, 'node1', 1400);
    expect(seam.mappedTimeMs).toBe(1400);
    expect(seam.isGeneratedZone).toBe(false);

    const mid = getBoomerangSourceTime(anim, 'node1', 1700);
    expect(mid.mappedTimeMs).toBeCloseTo(700, 1);
    expect(mid.isGeneratedZone).toBe(true);

    const end = getBoomerangSourceTime(anim, 'node1', 2000);
    expect(end.mappedTimeMs).toBe(0);
    expect(end.isGeneratedZone).toBe(true);
  });

  it('maps time past duration to 0', () => {
    const anim = makeAnim({
      duration: 2000,
      boomerangTargets: { node1: { sourceEndMs: 1200 } },
    });
    const result = getBoomerangSourceTime(anim, 'node1', 2500);
    expect(result.mappedTimeMs).toBe(0);
    expect(result.isGeneratedZone).toBe(true);
  });

  it('two independent targets do not interfere', () => {
    const anim = makeAnim({
      duration: 2000,
      boomerangTargets: { node1: { sourceEndMs: 1000 }, node2: { sourceEndMs: 1500 } },
    });
    const r1 = getBoomerangSourceTime(anim, 'node1', 1500);
    expect(r1.mappedTimeMs).toBeCloseTo(1000 * (2000 - 1500) / (2000 - 1000), 0);
    expect(r1.isGeneratedZone).toBe(true);

    const r2 = getBoomerangSourceTime(anim, 'node1', 500);
    expect(r2.mappedTimeMs).toBe(500);
    expect(r2.isGeneratedZone).toBe(false);

    const r3 = getBoomerangSourceTime(anim, 'node2', 1600);
    expect(r3.mappedTimeMs).toBeGreaterThan(0);
    expect(r3.isGeneratedZone).toBe(true);
  });

  it('returns unchanged time for non-enabled target even when others have boomerang', () => {
    const anim = makeAnim({
      duration: 2000,
      boomerangTargets: { node1: { sourceEndMs: 1000 } },
    });
    const r = getBoomerangSourceTime(anim, 'node2', 1500);
    expect(r).toEqual({ mappedTimeMs: 1500, isGeneratedZone: false });
  });
});

// ── computePoseOverrides with boomerang ─────────────────────────────────────

describe('computePoseOverrides with boomerang', () => {
  it('evaluates non-boomerang target identically with or without boomerang field', () => {
    const tracks = [
      simpleTrack('node1', 'x', [kf(0, 0), kf(1000, 100)]),
    ];
    const without = computePoseOverrides(makeAnim({ tracks }), 500);
    const withBoomerang = computePoseOverrides(
      makeAnim({ tracks, boomerangTargets: { node2: { sourceEndMs: 700 } } }),
      500,
    );
    expect(withBoomerang.get('node1').x).toBe(without.get('node1').x);
  });

  it('maps scalar value correctly at the seam (t = sourceEndMs)', () => {
    // Keys at 0→0, 700→70. At t=700 (seam) → value=70
    const anim = makeAnim({
      duration: 1000,
      boomerangTargets: { node1: { sourceEndMs: 700 } },
      tracks: [
        simpleTrack('node1', 'x', [kf(0, 0), kf(700, 70)]),
      ],
    });
    const result = computePoseOverrides(anim, 700);
    expect(result.get('node1').x).toBe(70);
  });

  it('maps scalar value at end (t = duration) to value at authored time 0', () => {
    const anim = makeAnim({
      duration: 1000,
      boomerangTargets: { node1: { sourceEndMs: 700 } },
      tracks: [
        simpleTrack('node1', 'x', [kf(0, 0), kf(700, 70)]),
      ],
    });
    // At t=1000, mappedTime=0 → value=0
    const result = computePoseOverrides(anim, 1000);
    expect(result.get('node1').x).toBe(0);
  });

  it('maps scalar value at midpoint of generated zone', () => {
    const anim = makeAnim({
      duration: 1000,
      boomerangTargets: { node1: { sourceEndMs: 600 } },
      tracks: [
        simpleTrack('node1', 'x', [kf(0, 0), kf(600, 60)]),
      ],
    });
    // At t=800: mappedTime = 600 * (1000-800)/(1000-600) = 600*200/400 = 300
    // At t=300 between kf 0→0 and 600→60: value=30
    const result = computePoseOverrides(anim, 800);
    expect(result.get('node1').x).toBe(30);
  });

  it('evaluates boolean properties with boomerang time mapping', () => {
    const anim = makeAnim({
      duration: 1000,
      boomerangTargets: { node1: { sourceEndMs: 600 } },
      tracks: [
        simpleTrack('node1', 'visible', [kf(0, true), kf(400, false), kf(600, true)]),
      ],
    });
    // At t=1000, mappedTime=0 → visible=true
    const result = computePoseOverrides(anim, 1000);
    expect(result.get('node1').visible).toBe(true);
  });

  it('evaluates mesh_verts with boomerang time mapping', () => {
    const anim = makeAnim({
      duration: 1000,
      boomerangTargets: { node1: { sourceEndMs: 700 } },
      tracks: [
        simpleTrack('node1', 'mesh_verts', [kf(0, [{ x: 0, y: 0 }]), kf(700, [{ x: 100, y: 200 }])]),
      ],
    });
    // At t=1000, mappedTime=0 → mesh_verts = [{x:0, y:0}]
    const result = computePoseOverrides(anim, 1000);
    expect(result.get('node1').mesh_verts).toEqual([{ x: 0, y: 0 }]);
  });

  it('matches A3 scenario: 70% authored, seam, end', () => {
    const anim = makeAnim({
      duration: 2000,
      fps: 30,
      boomerangTargets: { node1: { sourceEndMs: 1400 } },
      tracks: [
        simpleTrack('node1', 'x', [kf(0, 0), kf(1400, 140)]),
      ],
    });
    // Seam at t=1400: value=140
    const seam = computePoseOverrides(anim, 1400);
    expect(seam.get('node1').x).toBe(140);
    // End at t=2000: mappedTime=0 → value=0
    const end = computePoseOverrides(anim, 2000);
    expect(end.get('node1').x).toBe(0);
    // At t=1000 (source zone): value=100
    const source = computePoseOverrides(anim, 1000);
    expect(source.get('node1').x).toBe(100);
  });

  it('does not mutate animation tracks', () => {
    const tracks = [simpleTrack('node1', 'x', [kf(0, 0), kf(600, 60)])];
    const anim = makeAnim({
      duration: 1000,
      boomerangTargets: { node1: { sourceEndMs: 600 } },
      tracks,
    });
    const snapshot = JSON.stringify(anim.tracks);
    computePoseOverrides(anim, 800);
    expect(JSON.stringify(anim.tracks)).toBe(snapshot);
  });

  it('uses current authored keys after BOOMERANG was enabled while preserving its fixed cutoff', () => {
    const anim = makeAnim({
      duration: 1000,
      fps: 1000,
      boomerangTargets: { node1: { sourceEndMs: 600 } },
      tracks: [simpleTrack('node1', 'x', [kf(0, 0), kf(300, 100), kf(600, 200)])],
    });
    anim.tracks[0].keyframes[1].value = 140;

    expect(anim.boomerangTargets.node1.sourceEndMs).toBe(600);
    expect(computePoseOverrides(anim, 800).get('node1').x).toBe(140);
  });
});

// ── expandAnimationForExport ─────────────────────────────────────────────────

describe('expandAnimationForExport', () => {
  it('returns original reference when no boomerang target', () => {
    const anim = makeAnim({ duration: 1000, tracks: [simpleTrack('n1', 'x', [kf(0, 0), kf(500, 50)])] });
    const expanded = expandAnimationForExport(anim);
    expect(expanded).toBe(anim);
  });

  it('appends keyframe at duration with value from authored time 0 for each target track', () => {
    const anim = makeAnim({
      duration: 1000,
      boomerangTargets: { node1: { sourceEndMs: 700 } },
      tracks: [
        simpleTrack('node1', 'x', [kf(0, 0), kf(700, 70)]),
        simpleTrack('node1', 'opacity', [kf(0, 1), kf(700, 0.5)]),
      ],
    });
    const expanded = expandAnimationForExport(anim);
    expect(expanded).not.toBe(anim);

    const xTrack = expanded.tracks.find(t => t.property === 'x');
    const lastX = xTrack.keyframes[xTrack.keyframes.length - 1];
    expect(lastX.time).toBe(1000);
    expect(lastX.value).toBe(0); // authored at t=0

    const opacityTrack = expanded.tracks.find(t => t.property === 'opacity');
    const lastO = opacityTrack.keyframes[opacityTrack.keyframes.length - 1];
    expect(lastO.time).toBe(1000);
    expect(lastO.value).toBe(1); // authored at t=0
  });

  it('does not expand tracks of non-boomerang targets', () => {
    const tracks = [
      simpleTrack('node1', 'x', [kf(0, 0), kf(700, 70)]),
      simpleTrack('node2', 'y', [kf(0, 10), kf(500, 50)]),
    ];
    const anim = makeAnim({
      duration: 1000,
      boomerangTargets: { node1: { sourceEndMs: 700 } },
      tracks,
    });
    const expanded = expandAnimationForExport(anim);
    const yTrack = expanded.tracks.find(t => t.property === 'y');
    expect(yTrack.keyframes.length).toBe(2); // unchanged
  });

  it('expands mesh_verts track with boomerang mesh value', () => {
    const anim = makeAnim({
      duration: 1000,
      boomerangTargets: { node1: { sourceEndMs: 700 } },
      tracks: [
        simpleTrack('node1', 'mesh_verts', [kf(0, [{ x: 0, y: 0 }]), kf(700, [{ x: 100, y: 200 }])]),
      ],
    });
    const expanded = expandAnimationForExport(anim);
    const mvTrack = expanded.tracks.find(t => t.property === 'mesh_verts');
    const last = mvTrack.keyframes[mvTrack.keyframes.length - 1];
    expect(last.time).toBe(1000);
    expect(last.value).toEqual([{ x: 0, y: 0 }]);
  });

  it('preserves easing from last authored keyframe', () => {
    const anim = makeAnim({
      duration: 1000,
      boomerangTargets: { node1: { sourceEndMs: 700 } },
      tracks: [
        simpleTrack('node1', 'x', [kf(0, 0, 'linear'), kf(700, 70, 'ease-out')]),
      ],
    });
    const expanded = expandAnimationForExport(anim);
    const xTrack = expanded.tracks.find(t => t.property === 'x');
    const last = xTrack.keyframes[xTrack.keyframes.length - 1];
    expect(last.easing).toBe('ease-out');
  });
});

// ── checkBoomerangEligibility / checkBoomerangTimeBlocked ────────────────────

describe('boomerang guard helpers', () => {
  it('checkBoomerangEligibility returns not eligible when no authored keys', () => {
    const anim = makeAnim({ duration: 2000, tracks: [] });
    const result = checkBoomerangEligibility(anim, 'node1');
    expect(result.eligible).toBe(false);
    expect(result.reasonCode).toBe('no_authored_keys');
  });

  it('checkBoomerangEligibility returns not eligible when keys fill full duration', () => {
    const anim = makeAnim({
      duration: 1000,
      tracks: [simpleTrack('node1', 'x', [kf(0, 0), kf(1000, 100)])],
    });
    const result = checkBoomerangEligibility(anim, 'node1');
    expect(result.eligible).toBe(false);
    expect(result.reasonCode).toBe('no_room');
  });

  it('checkBoomerangEligibility returns eligible when keys end before duration', () => {
    const anim = makeAnim({
      duration: 1000,
      tracks: [simpleTrack('node1', 'x', [kf(0, 0), kf(700, 70)])],
    });
    const result = checkBoomerangEligibility(anim, 'node1');
    expect(result.eligible).toBe(true);
    expect(result.sourceEndMs).toBe(700);
  });

  it('checkBoomerangTimeBlocked allows writes in source zone', () => {
    const anim = makeAnim({
      duration: 1000,
      boomerangTargets: { node1: { sourceEndMs: 700 } },
    });
    expect(checkBoomerangTimeBlocked(anim, 'node1', 500).blocked).toBe(false);
    expect(checkBoomerangTimeBlocked(anim, 'node1', 700).blocked).toBe(false);
  });

  it('checkBoomerangTimeBlocked rejects writes in generated zone', () => {
    const anim = makeAnim({
      duration: 1000,
      boomerangTargets: { node1: { sourceEndMs: 700 } },
    });
    const result = checkBoomerangTimeBlocked(anim, 'node1', 701);
    expect(result.blocked).toBe(true);
    expect(result.reasonCode).toBe('boomerang_generated_range');
  });

  it('checkBoomerangTimeBlocked returns not blocked for non-enabled target', () => {
    const anim = makeAnim({
      duration: 1000,
      boomerangTargets: { node1: { sourceEndMs: 700 } },
    });
    expect(checkBoomerangTimeBlocked(anim, 'node2', 900).blocked).toBe(false);
  });

  it('getTargetAuthoredEndMs returns -1 for target with no tracks', () => {
    const anim = makeAnim({ duration: 1000, tracks: [] });
    expect(getTargetAuthoredEndMs(anim, 'node1')).toBe(-1);
  });

  it('getTargetAuthoredEndMs returns latest keyframe time for target', () => {
    const anim = makeAnim({
      duration: 1000,
      tracks: [
        simpleTrack('node1', 'x', [kf(0, 0), kf(300, 30), kf(700, 70)]),
        simpleTrack('node2', 'y', [kf(0, 0), kf(500, 50)]),
      ],
    });
    expect(getTargetAuthoredEndMs(anim, 'node1')).toBe(700);
    expect(getTargetAuthoredEndMs(anim, 'node2')).toBe(500);
  });

  it('getBoomerangCutoff returns enabled=false for missing boomerangTargets', () => {
    const anim = makeAnim({ duration: 1000 });
    expect(getBoomerangCutoff(anim, 'node1')).toEqual({ enabled: false });
  });

  it('getBoomerangCutoff returns correct sourceEndMs', () => {
    const anim = makeAnim({
      duration: 1000,
      boomerangTargets: { node1: { sourceEndMs: 700 } },
    });
    expect(getBoomerangCutoff(anim, 'node1')).toEqual({ enabled: true, sourceEndMs: 700 });
  });
});
