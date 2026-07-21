import { describe, it, expect } from 'vitest';
import { executeDeformPipeline } from '../src/runtime/deformPipeline.js';

describe('deformPipeline', () => {
  it('returns empty draw list for project with no parts', () => {
    const project = { bones: [], nodes: [] };
    const result = executeDeformPipeline(project);
    expect(result.drawList).toEqual([]);
  });

  it('skips hidden nodes', () => {
    const project = {
      bones: [],
      nodes: [{ id: 'n1', type: 'part', name: 'test', visible: false }],
    };
    const result = executeDeformPipeline(project);
    expect(result.drawList).toHaveLength(0);
  });

  it('sorts by draw order', () => {
    const project = {
      bones: [],
      nodes: [
        { id: 'n1', type: 'part', name: 'a', visible: true, draw_order: 2, mesh: { vertices: new Float32Array([0, 0]) } },
        { id: 'n2', type: 'part', name: 'b', visible: true, draw_order: 0, mesh: { vertices: new Float32Array([0, 0]) } },
      ],
    };
    const result = executeDeformPipeline(project);
    expect(result.drawList[0].nodeId).toBe('n2');
    expect(result.drawList[1].nodeId).toBe('n1');
  });

  it('applies blend shapes', () => {
    const project = {
      bones: [],
      nodes: [{
        id: 'n1', type: 'part', name: 'test', visible: true, draw_order: 0,
        mesh: { vertices: new Float32Array([0, 0, 10, 0]) },
        blendShapes: [{ id: 'bs1', name: 'smile', deltas: [{ dx: 5, dy: 0 }, { dx: -5, dy: 0 }] }],
        blendShapeValues: { bs1: 0.5 },
      }],
    };
    const result = executeDeformPipeline(project);
    expect(result.drawList[0].vertices[0]).toBeCloseTo(2.5, 4);
    expect(result.drawList[0].vertices[2]).toBeCloseTo(7.5, 4);
  });

  it('collects clip regions', () => {
    const project = {
      bones: [],
      nodes: [
        { id: 'mask', type: 'part', name: 'mask', visible: true, draw_order: 0, mesh: { vertices: new Float32Array([0, 0]) } },
        { id: 'n1', type: 'part', name: 'clipped', visible: true, draw_order: 1, clip_mask: 'mask', mesh: { vertices: new Float32Array([0, 0]) } },
      ],
    };
    const result = executeDeformPipeline(project);
    expect(result.clipRegions).toHaveLength(1);
    expect(result.clipRegions[0].maskNodeId).toBe('mask');
  });
});
