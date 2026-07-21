import { describe, it, expect } from 'vitest';
import {
  findNearestVertex,
  sampleAlpha,
  sortPartsForPicking,
  findAlphaHit,
  findBoneHit,
  computeBoneSelectionFromClick,
  selectBonesInRect,
  selectConstraintsInRect,
} from '@/features/canvas/domain/picking.js';

describe('findNearestVertex', () => {
  it('returns index of closest vertex', () => {
    const verts = [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 50, y: 50 }];
    expect(findNearestVertex(verts, 9, 9, 20)).toBe(1);
  });

  it('returns -1 when nothing within radius', () => {
    const verts = [{ x: 0, y: 0 }, { x: 100, y: 100 }];
    expect(findNearestVertex(verts, 50, 50, 5)).toBe(-1);
  });

  it('handles empty vertices', () => {
    expect(findNearestVertex([], 0, 0, 10)).toBe(-1);
  });
});

describe('sampleAlpha', () => {
  it('returns 0 for out-of-bounds', () => {
    const id = { width: 2, height: 2, data: new Uint8ClampedArray(16) };
    expect(sampleAlpha(id, -1, 0)).toBe(0);
    expect(sampleAlpha(id, 5, 5)).toBe(0);
  });

  it('returns alpha at integer coords', () => {
    const data = new Uint8ClampedArray(16);
    data[7] = 200; // pixel (1,0) alpha
    const id = { width: 2, height: 2, data };
    expect(sampleAlpha(id, 1, 0)).toBe(200);
  });
});

describe('sortPartsForPicking', () => {
  it('sorts by descending draw_order', () => {
    const parts = [
      { id: 'a', draw_order: 1 },
      { id: 'b', draw_order: 5 },
      { id: 'c', draw_order: 3 },
    ];
    const sorted = sortPartsForPicking(parts);
    expect(sorted.map(p => p.id)).toEqual(['b', 'c', 'a']);
  });

  it('treats missing draw_order as 0', () => {
    const parts = [{ id: 'a' }, { id: 'b', draw_order: 2 }, { id: 'c', draw_order: 0 }];
    const sorted = sortPartsForPicking(parts);
    expect(sorted.map(p => p.id)).toEqual(['b', 'a', 'c']);
  });
});

describe('findAlphaHit', () => {
  it('returns partId with non-zero alpha hit, preferring higher draw_order', () => {
    const idA = { width: 2, height: 2, data: new Uint8ClampedArray(16) };
    idA.data[3] = 200; // pixel (0,0)
    const idB = { width: 2, height: 2, data: new Uint8ClampedArray(16) };
    idB.data[3] = 200; // pixel (0,0)
    const parts = [
      { id: 'a', draw_order: 1 },
      { id: 'b', draw_order: 5 },
    ];
    const imageDataByPartId = new Map([['a', idA], ['b', idB]]);
    // Identity inverse (translate by 0,0): local = world
    const inv = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    const worldMatrices = new Map([['a', inv], ['b', inv]]);
    const hit = findAlphaHit({ parts, imageDataByPartId, worldMatrices, worldX: 0, worldY: 0 });
    expect(hit).toBe('b');
  });

  it('returns null when no alpha hit', () => {
    const idA = { width: 2, height: 2, data: new Uint8ClampedArray(16) };
    const parts = [{ id: 'a', draw_order: 1 }];
    const inv = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    const worldMatrices = new Map([['a', inv]]);
    const hit = findAlphaHit({ parts, imageDataByPartId: new Map([['a', idA]]), worldMatrices, worldX: 50, worldY: 50 });
    expect(hit).toBeNull();
  });

  it('uses local-to-world matrix to hit translated parts', () => {
    const imageData = { width: 4, height: 4, data: new Uint8ClampedArray(4 * 4 * 4) };
    imageData.data[(1 * 4 + 1) * 4 + 3] = 255;
    const wm = new Float32Array([1, 0, 0, 0, 1, 0, 100, 50, 1]);

    const hit = findAlphaHit({
      parts: [{ id: 'translated', draw_order: 0 }],
      imageDataByPartId: new Map([['translated', imageData]]),
      worldMatrices: new Map([['translated', wm]]),
      worldX: 101,
      worldY: 51,
    });

    expect(hit).toBe('translated');
  });
});

describe('findBoneHit', () => {
  it('hits a root bone segment', () => {
    const hit = findBoneHit({
      bones: [{
        id: 'bone1',
        setup: { x: 0, y: 0, rotation: 0, length: 100 },
      }],
      worldX: 50,
      worldY: 4,
      zoom: 1,
    });

    expect(hit).toBe('bone1');
  });

  it('uses the child bone own origin, rotation, and length', () => {
    const hit = findBoneHit({
      bones: [
        { id: 'root', setup: { x: 0, y: 0, rotation: 0, length: 10 } },
        { id: 'child', parentId: 'root', setup: { x: 100, y: 0, rotation: 0, length: 10 } },
      ],
      worldX: 105,
      worldY: 3,
      zoom: 1,
    });

    expect(hit).toBe('child');
  });
});

describe('computeBoneSelectionFromClick', () => {
  const order = ['b1', 'b2', 'b3', 'b4', 'b5'];

  it('no modifier replaces selection with single bone', () => {
    expect(computeBoneSelectionFromClick({
      orderedBoneIds: order,
      currentSelection: ['b1', 'b2'],
      anchorBoneId: 'b1',
      boneHit: 'b4',
      shiftKey: false,
      ctrlOrMetaKey: false,
    })).toEqual(['b4']);
  });

  it('ctrl/cmd toggles hit bone in current selection', () => {
    expect(computeBoneSelectionFromClick({
      orderedBoneIds: order,
      currentSelection: ['b1', 'b2'],
      anchorBoneId: 'b1',
      boneHit: 'b3',
      shiftKey: false,
      ctrlOrMetaKey: true,
    })).toEqual(['b1', 'b2', 'b3']);
  });

  it('ctrl/cmd removes hit bone when already in selection', () => {
    expect(computeBoneSelectionFromClick({
      orderedBoneIds: order,
      currentSelection: ['b1', 'b2', 'b3'],
      anchorBoneId: 'b2',
      boneHit: 'b2',
      shiftKey: false,
      ctrlOrMetaKey: true,
    })).toEqual(['b1', 'b3']);
  });

  it('shift range from anchor to hit (forward)', () => {
    expect(computeBoneSelectionFromClick({
      orderedBoneIds: order,
      currentSelection: ['b2'],
      anchorBoneId: 'b2',
      boneHit: 'b4',
      shiftKey: true,
      ctrlOrMetaKey: false,
    })).toEqual(['b2', 'b3', 'b4']);
  });

  it('shift range from anchor to hit (backward)', () => {
    expect(computeBoneSelectionFromClick({
      orderedBoneIds: order,
      currentSelection: ['b5'],
      anchorBoneId: 'b5',
      boneHit: 'b3',
      shiftKey: true,
      ctrlOrMetaKey: false,
    })).toEqual(['b3', 'b4', 'b5']);
  });

  it('shift range falls back to single bone when anchor is missing', () => {
    expect(computeBoneSelectionFromClick({
      orderedBoneIds: order,
      currentSelection: [],
      anchorBoneId: null,
      boneHit: 'b2',
      shiftKey: true,
      ctrlOrMetaKey: false,
    })).toEqual(['b2']);
  });

  it('ignores non-bone ids in current selection', () => {
    expect(computeBoneSelectionFromClick({
      orderedBoneIds: order,
      currentSelection: ['b1', 'partA', 'b3'],
      anchorBoneId: 'b3',
      boneHit: 'b2',
      shiftKey: true,
      ctrlOrMetaKey: false,
    })).toEqual(['b2', 'b3']);
  });
});

describe('selectBonesInRect', () => {
  const bones = [
    { id: 'arm', name: 'Arm', parentId: null, setup: { x: 0, y: 0, length: 60, rotation: 0 } },
    { id: 'torso', name: 'Torso', parentId: null, setup: { x: 0, y: 0, length: 80, rotation: 90 } },
    { id: 'far', name: 'Far', parentId: null, setup: { x: 500, y: 500, length: 100, rotation: 0 } },
  ];

  it('returns empty when no bones or rect', () => {
    expect(selectBonesInRect({ bones: [], rect: { x: 0, y: 0, w: 100, h: 100 } })).toEqual([]);
    expect(selectBonesInRect({ bones, rect: null })).toEqual([]);
  });

  it('picks bones with both endpoints inside the rect', () => {
    const result = selectBonesInRect({
      bones,
      rect: { x: -10, y: -10, w: 80, h: 100 },
    });
    expect(result).toContain('arm');
    expect(result).toContain('torso');
    expect(result).not.toContain('far');
  });

  it('picks bones whose segment crosses the rect edge', () => {
    const b = [{ id: 'cross', name: 'Cross', parentId: null, setup: { x: -50, y: 50, length: 200, rotation: 0 } }];
    const result = selectBonesInRect({ bones: b, rect: { x: 0, y: 0, w: 100, h: 100 } });
    expect(result).toEqual(['cross']);
  });

  it('preserves bone order from input list', () => {
    const result = selectBonesInRect({ bones, rect: { x: -1000, y: -1000, w: 2000, h: 2000 } });
    expect(result).toEqual(['arm', 'torso', 'far']);
  });

  it('handles negative rect (drag from right-bottom to left-top)', () => {
    const result = selectBonesInRect({ bones, rect: { x: 80, y: 80, w: -90, h: -80 } });
    expect(result).toContain('arm');
    expect(result).toContain('torso');
    expect(result).not.toContain('far');
  });
});

describe('selectConstraintsInRect', () => {
  const bones = [
    { id: 'arm', name: 'Arm', parentId: null, setup: { x: 0, y: 0, length: 60, rotation: 0 } },
    { id: 'torso', name: 'Torso', parentId: null, setup: { x: 0, y: 0, length: 80, rotation: 90 } },
  ];
  const constraints = [
    { id: 'c1', targetBoneId: 'arm' },
    { id: 'c2', targetBoneId: 'torso' },
    { id: 'c3', targetBoneId: 'unknown' },
  ];

  it('returns empty for missing inputs', () => {
    expect(selectConstraintsInRect({ constraints: [], bones, rect: { x: 0, y: 0, w: 100, h: 100 } })).toEqual([]);
    expect(selectConstraintsInRect({ constraints, bones: [], rect: { x: 0, y: 0, w: 100, h: 100 } })).toEqual([]);
    expect(selectConstraintsInRect({ constraints, bones, rect: null })).toEqual([]);
  });

  it('picks constraints whose target bone segment crosses the rect', () => {
    const result = selectConstraintsInRect({
      constraints,
      bones,
      rect: { x: -10, y: -10, w: 100, h: 100 },
    });
    expect(result).toEqual(['c1', 'c2']);
  });

  it('skips constraints whose targetBoneId is missing', () => {
    const result = selectConstraintsInRect({
      constraints,
      bones,
      rect: { x: -1000, y: -1000, w: 2000, h: 2000 },
    });
    expect(result).toEqual(['c1', 'c2']);
  });
});
