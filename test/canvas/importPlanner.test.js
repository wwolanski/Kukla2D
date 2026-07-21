import { describe, it, expect } from 'vitest';
import { planPngImport, planPsdFinalize } from '@/features/canvas/domain/import/importPlanner.js';

describe('planPngImport', () => {
  it('returns expected structure for a single PNG', () => {
    const p = planPngImport({ fileName: 'arm.png', imageWidth: 256, imageHeight: 256, imageBounds: null, partId: 'p1' });
    expect(p.canvasPatch).toEqual({ width: 256, height: 256 });
    expect(p.partsToCreate).toHaveLength(1);
    expect(p.partsToCreate[0].id).toBe('p1');
    expect(p.partsToCreate[0].name).toBe('arm');
    expect(p.texturesToCreate).toHaveLength(1);
    expect(p.imageDataRequests).toHaveLength(1);
  });
});

describe('planPsdFinalize', () => {
  it('builds groups, parts, textures, requests', () => {
    const layers = [
      { name: 'L1', width: 100, height: 100, bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 } },
      { name: 'L2', width: 100, height: 100, bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 } },
    ];
    const plan = planPsdFinalize({
      psdW: 200, psdH: 300, layers, partIds: ['p1', 'p2'],
      groupDefs: [{ id: 'g1', name: 'head', role: 'head' }],
    });
    expect(plan.canvasPatch).toEqual({ width: 200, height: 300 });
    expect(plan.groupsToCreate).toEqual([{ id: 'g1', name: 'head', type: 'group', boneRole: 'head', parent: null }]);
    expect(plan.partsToCreate).toHaveLength(2);
    // Default draw order: layers.length - 1 - i
    expect(plan.partsToCreate[0].draw_order).toBe(1);
    expect(plan.partsToCreate[1].draw_order).toBe(0);
    // Pivot = psdW/2, psdH/2
    expect(plan.partsToCreate[0].transform.pivotX).toBe(100);
    expect(plan.partsToCreate[0].transform.pivotY).toBe(150);
  });

  it('honors assignments for drawOrder and parent', () => {
    const layers = [
      { name: 'L1', width: 10, height: 10, bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 } },
    ];
    const plan = planPsdFinalize({
      psdW: 20, psdH: 20, layers, partIds: ['p1'],
      groupDefs: [{ id: 'g1', name: 'head', role: 'head' }],
      assignments: [{ drawOrder: 5, parentGroupId: 'g1' }],
    });
    expect(plan.partsToCreate[0].draw_order).toBe(5);
    expect(plan.partsToCreate[0].parent).toBe('g1');
  });

  it('throws on length mismatch', () => {
    expect(() => planPsdFinalize({
      psdW: 10, psdH: 10, layers: [{ name: 'a', width: 1, height: 1 }], partIds: ['a', 'b'],
    })).toThrow(/mismatch/);
  });
});
