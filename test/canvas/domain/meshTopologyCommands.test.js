import { describe, expect, it } from 'vitest';
import { applyMeshTopologyChange, analyzeMeshTopologyImpact } from '@/features/canvas/domain/meshTopologyCommands.js';

function makeNode(meshOverrides = {}) {
  return {
    id: 'part-1',
    type: 'part',
    imageWidth: 100,
    imageHeight: 100,
    mesh: {
      vertices: [
        { x: 0, y: 0, restX: 0, restY: 0 },
        { x: 100, y: 0, restX: 100, restY: 0 },
        { x: 100, y: 100, restX: 100, restY: 100 },
        { x: 0, y: 100, restX: 0, restY: 100 },
      ],
      uvs: [0, 0, 1, 0, 1, 1, 0, 1],
      triangles: [[0, 1, 2], [0, 2, 3]],
      edgeIndices: [0, 1, 2, 3],
      ...meshOverrides,
    },
  };
}

function makeProject(node, animations = []) {
  return { nodes: [node], animations };
}

describe('applyMeshTopologyChange', () => {
  it('add extends influences and mesh_verts when lengths match', () => {
    const node = makeNode({
      influences: [
        [{ boneId: 'b1', weight: 1 }],
        [{ boneId: 'b1', weight: 0.5 }, { boneId: 'b2', weight: 0.5 }],
        [],
        [{ boneId: 'b2', weight: 1 }],
      ],
    });
    const project = makeProject(node, [{
      id: 'anim-1',
      tracks: [{
        targetId: 'part-1',
        property: 'mesh_verts',
        keyframes: [{
          time: 0,
          value: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
        }],
      }],
    }]);

    applyMeshTopologyChange(project, 'part-1', {
      type: 'add',
      vertex: { x: 50, y: 50 },
      imageWidth: 100,
      imageHeight: 100,
    });

    expect(node.mesh.influences).toHaveLength(5);
    expect(node.mesh.influences[4]).toEqual([]);
    const track = project.animations[0].tracks[0];
    expect(track.keyframes[0].value).toHaveLength(5);
  });

  it('add clears influences and mesh_verts when lengths mismatch', () => {
    const node = makeNode({
      influences: [[{ boneId: 'b1', weight: 1 }], [{ boneId: 'b1', weight: 1 }]],
    });
    const project = makeProject(node, [{
      id: 'anim-1',
      tracks: [{
        targetId: 'part-1',
        property: 'mesh_verts',
        keyframes: [{
          time: 0,
          value: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        }],
      }],
    }]);

    applyMeshTopologyChange(project, 'part-1', {
      type: 'add',
      vertex: { x: 50, y: 50 },
      imageWidth: 100,
      imageHeight: 100,
    });

    expect(node.mesh.influences).toBeUndefined();
    expect(project.animations[0].tracks).toHaveLength(0);
  });

  it('remove filters influences and mesh_verts when lengths match', () => {
    const node = makeNode({
      influences: [
        [{ boneId: 'b1', weight: 1 }],
        [{ boneId: 'b1', weight: 0.5 }, { boneId: 'b2', weight: 0.5 }],
        [],
        [{ boneId: 'b2', weight: 1 }],
      ],
    });
    const project = makeProject(node, [{
      id: 'anim-1',
      tracks: [{
        targetId: 'part-1',
        property: 'mesh_verts',
        keyframes: [{
          time: 0,
          value: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
        }],
      }],
    }]);

    applyMeshTopologyChange(project, 'part-1', {
      type: 'remove',
      vertexIndex: 1,
      imageWidth: 100,
      imageHeight: 100,
    });

    expect(node.mesh.influences).toHaveLength(3);
    expect(node.mesh.influences.find(inf => inf.some(i => i.boneId === 'b2' && i.weight === 1))).toBeDefined();
    const track = project.animations[0].tracks[0];
    expect(track.keyframes[0].value).toHaveLength(3);
  });

  it('remove clears influences and mesh_verts when lengths mismatch', () => {
    const node = makeNode({
      influences: [[{ boneId: 'b1', weight: 1 }], [{ boneId: 'b1', weight: 1 }]],
    });
    const project = makeProject(node, [{
      id: 'anim-1',
      tracks: [{
        targetId: 'part-1',
        property: 'mesh_verts',
        keyframes: [{
          time: 0,
          value: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        }],
      }],
    }]);

    applyMeshTopologyChange(project, 'part-1', {
      type: 'remove',
      vertexIndex: 1,
      imageWidth: 100,
      imageHeight: 100,
    });

    expect(node.mesh.influences).toBeUndefined();
    expect(project.animations[0].tracks).toHaveLength(0);
  });

  it('remesh removes influences and mesh_verts tracks', () => {
    const node = makeNode({
      influences: [
        [{ boneId: 'b1', weight: 1 }],
        [{ boneId: 'b1', weight: 1 }],
        [{ boneId: 'b1', weight: 1 }],
        [{ boneId: 'b1', weight: 1 }],
      ],
    });
    node.blendShapes = [{ id: 'smile', deltas: [{ dx: 1, dy: 0 }, { dx: 1, dy: 0 }, { dx: 1, dy: 0 }, { dx: 1, dy: 0 }] }];
    const project = makeProject(node, [{
      id: 'anim-1',
      tracks: [{
        targetId: 'part-1',
        property: 'mesh_verts',
        keyframes: [{
          time: 0,
          value: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
        }],
      }],
    }]);

    applyMeshTopologyChange(project, 'part-1', {
      type: 'remesh',
      mesh: {
        vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 100 }],
        uvs: [0, 0, 1, 0, 0, 1],
        triangles: [[0, 1, 2]],
        edgeIndices: [0, 1, 2],
      },
      imageWidth: 100,
      imageHeight: 100,
    });

    expect(node.mesh.influences).toBeUndefined();
    expect(node.mesh.boneWeights).toBeUndefined();
    expect(project.animations[0].tracks).toHaveLength(0);
    expect(node.blendShapes).toHaveLength(0);
  });
});

describe('analyzeMeshTopologyImpact', () => {
  it('reports mesh track addresses and weight presence', () => {
    const node = makeNode({
      influences: [[{ boneId: 'b1', weight: 1 }]],
    });
    const project = makeProject(node, [{
      id: 'anim-1',
      tracks: [{
        targetId: 'part-1',
        property: 'mesh_verts',
        keyframes: [],
      }],
    }]);

    const impact = analyzeMeshTopologyImpact(project, 'part-1', 5);
    expect(impact.vertexCountChanged).toBe(true);
    expect(impact.meshTrackAddresses).toEqual([{ animationId: 'anim-1', trackIndex: 0 }]);
    expect(impact.hasWeights).toBe(true);
  });
});
