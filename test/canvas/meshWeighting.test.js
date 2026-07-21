import { describe, it, expect } from 'vitest';
import {
  WEIGHT_PAINT_MODES,
  clampWeight,
  ensureMeshInfluenceSlots,
  normalizeMeshInfluences,
  getVertexWeight,
  bindMeshToBone,
  bindUnweightedVerticesToBone,
  unbindMeshFromBone,
  applyAutoMeshWeights,
  computeMeshWeightStats,
  applyWeightBrush,
} from '@/features/canvas/domain/meshWeighting.js';

function makeMesh(vertices) {
  return { vertices: vertices.map(v => ({ x: v[0], y: v[1] })) };
}

function getSum(list) {
  return list.reduce((s, inf) => s + inf.weight, 0);
}

function verifyNormalized(list) {
  expect(list.length).toBeLessThanOrEqual(4);
  const sum = getSum(list);
  if (list.length > 0) {
    expect(sum).toBeCloseTo(1, 5);
  }
  for (const inf of list) {
    expect(inf.weight).toBeGreaterThanOrEqual(0);
    expect(inf.weight).toBeLessThanOrEqual(1);
  }
}

describe('WEIGHT_PAINT_MODES', () => {
  it('defines the four paint modes', () => {
    expect(WEIGHT_PAINT_MODES).toEqual(['add', 'subtract', 'replace', 'smooth']);
  });
});

describe('clampWeight', () => {
  it('clamps to [0, 1]', () => {
    expect(clampWeight(-0.1)).toBe(0);
    expect(clampWeight(0.5)).toBe(0.5);
    expect(clampWeight(1.5)).toBe(1);
  });

  it('falls back for non-finite values', () => {
    expect(clampWeight(Number.NaN)).toBe(0);
    expect(clampWeight(Number.POSITIVE_INFINITY)).toBe(0);
    expect(clampWeight(Number.NaN, 1)).toBe(1);
  });
});

describe('ensureMeshInfluenceSlots', () => {
  it('creates empty slots when missing', () => {
    const mesh = makeMesh([[0, 0], [10, 0]]);
    ensureMeshInfluenceSlots(mesh);
    expect(mesh.influences).toHaveLength(2);
    expect(mesh.influences[0]).toEqual([]);
  });

  it('replaces wrong-length array', () => {
    const mesh = makeMesh([[0, 0], [10, 0]]);
    mesh.influences = [[]];
    ensureMeshInfluenceSlots(mesh);
    expect(mesh.influences).toHaveLength(2);
  });

  it('leaves correct array untouched', () => {
    const mesh = makeMesh([[0, 0]]);
    mesh.influences = [[{ boneId: 'a', weight: 1 }]];
    ensureMeshInfluenceSlots(mesh);
    expect(mesh.influences[0][0].boneId).toBe('a');
  });
});

describe('normalizeMeshInfluences', () => {
  it('returns empty slots for non-array', () => {
    const slots = normalizeMeshInfluences(null, 2);
    expect(slots).toHaveLength(2);
    expect(slots[0]).toEqual([]);
  });

  it('normalizes and keeps top-4 per vertex', () => {
    const influences = [[
      { boneId: 'a', weight: 0.1 },
      { boneId: 'b', weight: 0.2 },
      { boneId: 'c', weight: 0.3 },
      { boneId: 'd', weight: 0.4 },
      { boneId: 'e', weight: 0.5 },
    ]];
    const slots = normalizeMeshInfluences(influences, 1);
    expect(slots[0]).toHaveLength(4);
    expect(slots[0][0].boneId).toBe('e');
    const sum = getSum(slots[0]);
    expect(sum).toBeCloseTo(1);
  });

  it('merges duplicate bone entries before normalizing', () => {
    const slots = normalizeMeshInfluences([[
      { boneId: 'a', weight: 0.25 },
      { boneId: 'a', weight: 0.25 },
      { boneId: 'b', weight: 0.5 },
    ]], 1);
    expect(slots[0]).toHaveLength(2);
    expect(slots[0].find(inf => inf.boneId === 'a').weight).toBeCloseTo(0.5);
    expect(slots[0].find(inf => inf.boneId === 'b').weight).toBeCloseTo(0.5);
  });

  it('pads to vertexCount', () => {
    const slots = normalizeMeshInfluences([[{ boneId: 'a', weight: 1 }]], 3);
    expect(slots).toHaveLength(3);
    expect(slots[0][0].boneId).toBe('a');
    expect(slots[1]).toEqual([]);
  });
});

describe('getVertexWeight', () => {
  it('returns 0 for missing list', () => {
    expect(getVertexWeight(null, 'a')).toBe(0);
  });

  it('returns weight when bone found', () => {
    expect(getVertexWeight([{ boneId: 'a', weight: 0.5 }], 'a')).toBe(0.5);
  });

  it('returns 0 when bone not found', () => {
    expect(getVertexWeight([{ boneId: 'a', weight: 1 }], 'b')).toBe(0);
  });
});

describe('bindMeshToBone', () => {
  it('binds all vertices to one bone with weight 1', () => {
    const mesh = makeMesh([[0, 0], [10, 0], [20, 0]]);
    bindMeshToBone(mesh, 'b1');
    expect(mesh.influences).toHaveLength(3);
    for (const list of mesh.influences) {
      expect(list).toHaveLength(1);
      expect(list[0].boneId).toBe('b1');
      expect(list[0].weight).toBeCloseTo(1);
    }
  });

  it('no-ops on empty mesh', () => {
    const mesh = { vertices: [] };
    bindMeshToBone(mesh, 'b1');
    expect(mesh.influences).toBeUndefined();
  });
});

describe('bindUnweightedVerticesToBone', () => {
  it('fills only empty influence slots', () => {
    const mesh = makeMesh([[0, 0], [10, 0]]);
    mesh.influences = [[{ boneId: 'b2', weight: 1 }], []];

    bindUnweightedVerticesToBone(mesh, 'b1');

    expect(mesh.influences).toEqual([
      [{ boneId: 'b2', weight: 1 }],
      [{ boneId: 'b1', weight: 1 }],
    ]);
  });
});

describe('unbindMeshFromBone', () => {
  it('removes bone from all vertices and normalizes', () => {
    const mesh = makeMesh([[0, 0], [10, 0]]);
    bindMeshToBone(mesh, 'b1');
    bindMeshToBone(mesh, 'b2');
    unbindMeshFromBone(mesh, 'b1');
    for (const list of mesh.influences) {
      expect(list.every(inf => inf.boneId !== 'b1')).toBe(true);
      verifyNormalized(list);
    }
  });

  it('no-ops on mesh without influences', () => {
    const mesh = makeMesh([[0, 0]]);
    unbindMeshFromBone(mesh, 'b1');
    expect(mesh.influences).toBeUndefined();
  });
});

describe('applyAutoMeshWeights', () => {
  const getBoneSegment = (id) => {
    const segs = { b1: { x1: 0, y1: 0, x2: 0, y2: 100 }, b2: { x1: 100, y1: 0, x2: 100, y2: 100 } };
    return segs[id] ?? null;
  };

  it('assigns distance-based weights to a 2-vertex mesh', () => {
    const mesh = makeMesh([[0, 0], [100, 0]]);
    applyAutoMeshWeights({ mesh, boneIds: ['b1', 'b2'], getBoneSegment, falloff: 80 });
    expect(mesh.influences).toHaveLength(2);
    for (const list of mesh.influences) {
      verifyNormalized(list);
    }
    expect(mesh.influences[0][0].boneId).toBe('b1');
    expect(mesh.influences[1][0].boneId).toBe('b2');
  });

  it('cuts off distant bones instead of spreading a global percentage', () => {
    const mesh = makeMesh([[0, 50]]);
    applyAutoMeshWeights({ mesh, boneIds: ['b1', 'b2'], getBoneSegment, falloff: 40 });
    expect(mesh.influences[0]).toEqual([{ boneId: 'b1', weight: 1 }]);
  });

  it('blends locally where two bone segments meet', () => {
    const mesh = makeMesh([[50, 50]]);
    applyAutoMeshWeights({ mesh, boneIds: ['b1', 'b2'], getBoneSegment, falloff: 80 });
    expect(getVertexWeight(mesh.influences[0], 'b1')).toBeCloseTo(0.5);
    expect(getVertexWeight(mesh.influences[0], 'b2')).toBeCloseTo(0.5);
  });

  it('can weight using transformed world-space vertex positions', () => {
    const mesh = makeMesh([[0, 0]]);
    applyAutoMeshWeights({
      mesh,
      boneIds: ['b1', 'b2'],
      getBoneSegment,
      falloff: 80,
      vertexToWorld: (x, y) => ({ x: x + 100, y }),
    });
    expect(mesh.influences[0][0].boneId).toBe('b2');
  });

  it('no-ops with empty boneIds', () => {
    const mesh = makeMesh([[0, 0]]);
    applyAutoMeshWeights({ mesh, boneIds: [], getBoneSegment });
    expect(mesh.influences).toBeUndefined();
  });

  it('no-ops when no segment found', () => {
    const mesh = makeMesh([[0, 0]]);
    applyAutoMeshWeights({ mesh, boneIds: ['b3'], getBoneSegment });
    expect(mesh.influences).toBeUndefined();
  });

  it('uses a safe falloff when falloff is invalid', () => {
    const mesh = makeMesh([[0, 0]]);
    applyAutoMeshWeights({ mesh, boneIds: ['b1'], getBoneSegment, falloff: 0 });
    verifyNormalized(mesh.influences[0]);
    expect(getVertexWeight(mesh.influences[0], 'b1')).toBeCloseTo(1);
  });
});

describe('computeMeshWeightStats', () => {
  it('returns zero stats for empty mesh', () => {
    const stats = computeMeshWeightStats({ vertices: [] });
    expect(stats.vertexCount).toBe(0);
    expect(stats.boundVertexCount).toBe(0);
    expect(stats.boneCount).toBe(0);
  });

  it('computes correct stats for a 2-vertex mesh', () => {
    const mesh = makeMesh([[0, 0], [10, 0]]);
    bindMeshToBone(mesh, 'b1');
    const stats = computeMeshWeightStats(mesh, 'b1');
    expect(stats.vertexCount).toBe(2);
    expect(stats.boundVertexCount).toBe(2);
    expect(stats.unboundVertexCount).toBe(0);
    expect(stats.boneCount).toBe(1);
    expect(stats.selectedBoneVertexCount).toBe(2);
    expect(stats.maxWeight).toBeCloseTo(1);
    expect(stats.minWeight).toBeCloseTo(1);
    expect(stats.averageWeight).toBeCloseTo(1);
  });

  it('tracks unbound vertices', () => {
    const mesh = makeMesh([[0, 0], [10, 0]]);
    ensureMeshInfluenceSlots(mesh);
    mesh.influences[0] = [{ boneId: 'b1', weight: 1 }];
    const stats = computeMeshWeightStats(mesh, 'b1');
    expect(stats.boundVertexCount).toBe(1);
    expect(stats.unboundVertexCount).toBe(1);
  });

  it('reports selectedBoneVertexCount correctly', () => {
    const mesh = makeMesh([[0, 0], [10, 0], [20, 0]]);
    bindMeshToBone(mesh, 'b1');
    const stats = computeMeshWeightStats(mesh, 'b2');
    expect(stats.selectedBoneVertexCount).toBe(0);
  });
});

describe('applyWeightBrush - add', () => {
  it('increases weight of selected bone and normalizes', () => {
    const mesh = makeMesh([[0, 0], [100, 0]]);
    bindMeshToBone(mesh, 'b1');

    applyWeightBrush({
      mesh, boneId: 'b2', localX: 0, localY: 0, radius: 50, hardness: 1,
      settings: { mode: 'add', strength: 0.5, targetWeight: 1 },
    });

    const vertex0 = mesh.influences[0];
    verifyNormalized(vertex0);
    expect(getVertexWeight(vertex0, 'b2')).toBeGreaterThan(0);

    const vertex1 = mesh.influences[1];
    verifyNormalized(vertex1);
    expect(getVertexWeight(vertex1, 'b2')).toBe(0);
  });

  it('increases weight with repeated add against falloff', () => {
    const mesh = makeMesh([[0, 0]]);
    bindMeshToBone(mesh, 'b1');
    const first = getVertexWeight(mesh.influences[0], 'b2');
    for (let i = 0; i < 5; i++) {
      applyWeightBrush({
        mesh, boneId: 'b2', localX: 0, localY: 0, radius: 50, hardness: 1,
        settings: { mode: 'add', strength: 0.5 },
      });
    }
    const later = getVertexWeight(mesh.influences[0], 'b2');
    expect(later).toBeGreaterThan(first);
    expect(later).toBeLessThanOrEqual(1);
    verifyNormalized(mesh.influences[0]);
  });
});

describe('applyWeightBrush - subtract', () => {
  it('reduces weight of selected bone', () => {
    const mesh = makeMesh([[0, 0]]);
    mesh.influences = [
      [{ boneId: 'b1', weight: 0.7 }, { boneId: 'b2', weight: 0.3 }],
    ];

    const before = getVertexWeight(mesh.influences[0], 'b2');
    applyWeightBrush({
      mesh, boneId: 'b2', localX: 0, localY: 0, radius: 50, hardness: 1,
      settings: { mode: 'subtract', strength: 0.2 },
    });
    const after = getVertexWeight(mesh.influences[0], 'b2');
    expect(after).toBeLessThan(before);
    verifyNormalized(mesh.influences[0]);
  });

  it('removes bone entirely when weight drops near zero', () => {
    const mesh = makeMesh([[0, 0]]);
    bindMeshToBone(mesh, 'b1');

    applyWeightBrush({
      mesh, boneId: 'b1', localX: 0, localY: 0, radius: 50, hardness: 1,
      settings: { mode: 'subtract', strength: 1 },
    });
    expect(getVertexWeight(mesh.influences[0], 'b1')).toBe(0);
  });

  it('never produces negative weights', () => {
    const mesh = makeMesh([[0, 0]]);
    bindMeshToBone(mesh, 'b1');

    applyWeightBrush({
      mesh, boneId: 'b1', localX: 0, localY: 0, radius: 50, hardness: 1,
      settings: { mode: 'subtract', strength: 10 },
    });
    for (const inf of mesh.influences[0]) {
      expect(inf.weight).toBeGreaterThanOrEqual(0);
    }
  });

  it('reduces a single-bone partial influence instead of renormalizing it back to 1', () => {
    const mesh = makeMesh([[0, 0]]);
    mesh.influences = [[{ boneId: 'b1', weight: 0.6 }]];

    applyWeightBrush({
      mesh, boneId: 'b1', localX: 0, localY: 0, radius: 50, hardness: 1,
      settings: { mode: 'subtract', strength: 0.25 },
    });

    expect(getVertexWeight(mesh.influences[0], 'b1')).toBeCloseTo(0.35);
  });
});

describe('applyWeightBrush - replace', () => {
  it('moves weight toward targetWeight relative to existing', () => {
    const mesh = makeMesh([[0, 0]]);
    mesh.influences = [
      [{ boneId: 'b1', weight: 0.3 }, { boneId: 'b2', weight: 0.7 }],
    ];

    const before = getVertexWeight(mesh.influences[0], 'b1');
    applyWeightBrush({
      mesh, boneId: 'b1', localX: 0, localY: 0, radius: 50, hardness: 1,
      settings: { mode: 'replace', strength: 0.5, targetWeight: 0.9 },
    });
    const after = getVertexWeight(mesh.influences[0], 'b1');
    expect(after).toBeGreaterThan(before);
    expect(after).toBeLessThan(0.9);
    verifyNormalized(mesh.influences[0]);
  });

  it('replaces selected bone weight with target when strength is 1', () => {
    const mesh = makeMesh([[0, 0]]);
    mesh.influences = [
      [{ boneId: 'b1', weight: 0.5 }, { boneId: 'b2', weight: 0.5 }],
    ];

    applyWeightBrush({
      mesh, boneId: 'b1', localX: 0, localY: 0, radius: 50, hardness: 1,
      settings: { mode: 'replace', strength: 1, targetWeight: 0.7 },
    });
    const w = getVertexWeight(mesh.influences[0], 'b1');
    expect(w).toBeCloseTo(0.7);
    verifyNormalized(mesh.influences[0]);
  });

  it('can replace a single-bone partial influence without forcing it to 1', () => {
    const mesh = makeMesh([[0, 0]]);
    mesh.influences = [[{ boneId: 'b1', weight: 1 }]];

    applyWeightBrush({
      mesh, boneId: 'b1', localX: 0, localY: 0, radius: 50, hardness: 1,
      settings: { mode: 'replace', strength: 1, targetWeight: 0.25 },
    });

    expect(getVertexWeight(mesh.influences[0], 'b1')).toBeCloseTo(0.25);
  });
});

describe('applyWeightBrush - smooth', () => {
  it('reduces local weight contrast without NaN', () => {
    const mesh = makeMesh([[0, 0], [5, 0], [10, 0]]);
    bindMeshToBone(mesh, 'b1');
    mesh.influences[1] = [{ boneId: 'b1', weight: 1 }];
    mesh.influences[1] = normalizeMeshInfluences([mesh.influences[1]], 1)[0];

    applyWeightBrush({
      mesh, boneId: 'b1', localX: 5, localY: 0, radius: 15, hardness: 1,
      settings: { mode: 'smooth', strength: 1 },
    });

    for (const list of mesh.influences) {
      for (const inf of list) {
        expect(Number.isNaN(inf.weight)).toBe(false);
        expect(inf.weight).toBeGreaterThanOrEqual(0);
      }
      verifyNormalized(list);
    }
  });

  it('does not introduce new bones', () => {
    const mesh = makeMesh([[0, 0], [10, 0]]);
    bindMeshToBone(mesh, 'b1');
    mesh.influences[1] = [{ boneId: 'b2', weight: 1 }];
    mesh.influences[1] = normalizeMeshInfluences([mesh.influences[1]], 1)[0];

    applyWeightBrush({
      mesh, boneId: 'b1', localX: 0, localY: 0, radius: 15, hardness: 1,
      settings: { mode: 'smooth', strength: 1 },
    });

    for (const list of mesh.influences) {
      for (const inf of list) {
        expect(['b1', 'b2']).toContain(inf.boneId);
      }
    }
  });

  it('smooth uses a stable snapshot and moves selected weights toward local average', () => {
    const mesh = makeMesh([[0, 0], [10, 0], [20, 0]]);
    mesh.influences = [
      [{ boneId: 'b1', weight: 0.9 }, { boneId: 'b2', weight: 0.1 }],
      [{ boneId: 'b1', weight: 0.1 }, { boneId: 'b2', weight: 0.9 }],
      [{ boneId: 'b1', weight: 0.5 }, { boneId: 'b2', weight: 0.5 }],
    ];

    applyWeightBrush({
      mesh, boneId: 'b1', localX: 0, localY: 0, radius: 30, hardness: 1,
      settings: { mode: 'smooth', strength: 1 },
    });

    expect(getVertexWeight(mesh.influences[0], 'b1')).toBeCloseTo(0.5);
    expect(getVertexWeight(mesh.influences[1], 'b1')).toBeCloseTo(0.5);
    expect(getVertexWeight(mesh.influences[2], 'b1')).toBeCloseTo(0.5);
    for (const list of mesh.influences) verifyNormalized(list);
  });
});

describe('applyWeightBrush - general', () => {
  it('defaults to add mode when no settings provided', () => {
    const mesh = makeMesh([[0, 0]]);
    bindMeshToBone(mesh, 'b1');
    applyWeightBrush({
      mesh, boneId: 'b1', localX: 0, localY: 0, radius: 50, hardness: 1,
    });
    expect(getVertexWeight(mesh.influences[0], 'b1')).toBeCloseTo(1);
  });

  it('sanitizes invalid settings without producing non-finite weights', () => {
    const mesh = makeMesh([[0, 0]]);
    mesh.influences = [[
      { boneId: 'b1', weight: 0.5 },
      { boneId: 'b2', weight: 0.5 },
    ]];

    applyWeightBrush({
      mesh, boneId: 'b1', localX: 0, localY: 0, radius: 50, hardness: Number.NaN,
      settings: { mode: 'unknown', strength: Number.NaN, targetWeight: Number.NaN },
    });

    verifyNormalized(mesh.influences[0]);
    for (const inf of mesh.influences[0]) {
      expect(Number.isFinite(inf.weight)).toBe(true);
    }
  });

  it('no-ops for invalid brush geometry', () => {
    const mesh = makeMesh([[0, 0]]);
    bindMeshToBone(mesh, 'b1');
    const before = structuredClone(mesh.influences);

    applyWeightBrush({
      mesh, boneId: 'b2', localX: 0, localY: 0, radius: 0, hardness: 1,
      settings: { mode: 'add', strength: 1 },
    });

    expect(mesh.influences).toEqual(before);
  });

  it('no-ops when brush misses all vertices', () => {
    const mesh = makeMesh([[1000, 1000]]);
    bindMeshToBone(mesh, 'b1');
    applyWeightBrush({
      mesh, boneId: 'b2', localX: 0, localY: 0, radius: 10, hardness: 1,
      settings: { mode: 'add', strength: 1 },
    });
    expect(getVertexWeight(mesh.influences[0], 'b2')).toBe(0);
  });

  it('preserves max top-4 influences after paint', () => {
    const mesh = makeMesh([[0, 0]]);
    mesh.influences = [[
      { boneId: 'a', weight: 0.25 },
      { boneId: 'b', weight: 0.25 },
      { boneId: 'c', weight: 0.25 },
      { boneId: 'd', weight: 0.25 },
    ]];
    applyWeightBrush({
      mesh, boneId: 'e', localX: 0, localY: 0, radius: 50, hardness: 1,
      settings: { mode: 'add', strength: 0.5 },
    });
    expect(mesh.influences[0].length).toBeLessThanOrEqual(4);
    verifyNormalized(mesh.influences[0]);
  });
});

describe('Non-empty lists sum to ~1 and max 4 influences', () => {
  function randomMesh(vertexCount) {
    const mesh = makeMesh(Array.from({ length: vertexCount }, () => [Math.random() * 100, Math.random() * 100]));
    return mesh;
  }

  it('bind produces valid lists', () => {
    for (let n = 1; n <= 5; n++) {
      const mesh = randomMesh(n);
      bindMeshToBone(mesh, 'b1');
      for (const list of mesh.influences) {
        verifyNormalized(list);
      }
    }
  });

  it('paint with all modes produces valid lists', () => {
    const mesh = randomMesh(4);
    bindMeshToBone(mesh, 'b1');

    for (const mode of ['add', 'subtract', 'replace', 'smooth']) {
      applyWeightBrush({
        mesh, boneId: 'b2', localX: 50, localY: 50, radius: 60, hardness: 0.5,
        settings: { mode, strength: 0.5, targetWeight: 0.7 },
      });
      for (const list of mesh.influences) {
        if (list.length > 0) verifyNormalized(list);
      }
    }
  });
});
