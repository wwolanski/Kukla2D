import { describe, it, expect, vi } from 'vitest';
import { syncEffectiveMeshFrames } from '@/features/canvas/application/syncEffectiveMeshFrames.js';

describe('syncEffectiveMeshFrames', () => {
  it('uploads effective mesh frame vertices and uvs for every part', () => {
    const gateway = {
      uploadPositions: vi.fn(),
    };
    const project = { nodes: [] };
    const effectiveMeshes = new Map([
      ['part-1', {
        vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        uvs: [0, 0, 1, 0],
        triangles: [[0, 1, 2]],
      }],
      ['part-2', {
        vertices: [{ x: 5, y: 5 }, { x: 95, y: 95 }],
        uvs: [0, 0, 1, 1],
        triangles: [[0, 1, 2]],
      }],
    ]);

    const ids = syncEffectiveMeshFrames({ gateway, project, effectiveMeshes, previousIds: new Set() });

    expect(gateway.uploadPositions).toHaveBeenCalledTimes(2);
    expect(gateway.uploadPositions).toHaveBeenCalledWith('part-1', effectiveMeshes.get('part-1').vertices, effectiveMeshes.get('part-1').uvs);
    expect(gateway.uploadPositions).toHaveBeenCalledWith('part-2', effectiveMeshes.get('part-2').vertices, effectiveMeshes.get('part-2').uvs);
    expect(ids.has('part-1')).toBe(true);
    expect(ids.has('part-2')).toBe(true);
  });

  it('skips frames without vertices', () => {
    const gateway = { uploadPositions: vi.fn() };
    const project = { nodes: [] };
    const effectiveMeshes = new Map([
      ['part-1', { vertices: [], uvs: [] }],
    ]);

    syncEffectiveMeshFrames({ gateway, project, effectiveMeshes, previousIds: new Set() });

    expect(gateway.uploadPositions).not.toHaveBeenCalled();
  });

  it('resets parts that disappeared from effective meshes back to setup vertices', () => {
    const gateway = { uploadPositions: vi.fn() };
    const project = {
      nodes: [
        {
          id: 'part-old',
          type: 'part',
          mesh: {
            vertices: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
            uvs: [0, 0, 1, 1],
          },
        },
      ],
    };
    const effectiveMeshes = new Map();

    const ids = syncEffectiveMeshFrames({
      gateway,
      project,
      effectiveMeshes,
      previousIds: new Set(['part-old']),
    });

    expect(ids.has('part-old')).toBe(false);
    expect(gateway.uploadPositions).toHaveBeenCalledWith(
      'part-old',
      project.nodes[0].mesh.vertices,
      project.nodes[0].mesh.uvs,
    );
  });

  it('does not reset parts still present in effective meshes', () => {
    const gateway = { uploadPositions: vi.fn() };
    const project = {
      nodes: [
        {
          id: 'part-1',
          type: 'part',
          mesh: {
            vertices: [{ x: 0, y: 0 }],
            uvs: [0, 0],
          },
        },
      ],
    };
    const effectiveMeshes = new Map([
      ['part-1', { vertices: [{ x: 7, y: 7 }], uvs: [0, 0] }],
    ]);

    syncEffectiveMeshFrames({
      gateway,
      project,
      effectiveMeshes,
      previousIds: new Set(['part-1']),
    });

    expect(gateway.uploadPositions).toHaveBeenCalledTimes(1);
    expect(gateway.uploadPositions).toHaveBeenCalledWith(
      'part-1',
      effectiveMeshes.get('part-1').vertices,
      effectiveMeshes.get('part-1').uvs,
    );
  });
});
