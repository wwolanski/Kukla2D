import { describe, it, expect } from 'vitest';
import { createGoldenProject } from '../fixtures/goldenProject';
import {
  analyzeMeshTopologyImpact,
  applyMeshTopologyChange,
} from '@/features/canvas/domain/meshTopologyCommands.js';

function cloneProject() {
  return JSON.parse(JSON.stringify(createGoldenProject()));
}

describe('analyzeMeshTopologyImpact', () => {
  it('returns K3 shape for golden fixture face node', () => {
    const project = cloneProject();
    const impact = analyzeMeshTopologyImpact(project, 'face', 4);
    expect(impact).toEqual({
      vertexCountChanged: false,
      blendShapeIds: ['smile'],
      meshTrackAddresses: [{ animationId: 'anim-idle', trackIndex: 0 }],
      hasWeights: true,
    });
  });

  it('detects vertexCountChanged when nextVertexCount differs', () => {
    const project = cloneProject();
    const impact = analyzeMeshTopologyImpact(project, 'face', 5);
    expect(impact.vertexCountChanged).toBe(true);
  });

  it('returns empty impact for missing node', () => {
    const project = cloneProject();
    const impact = analyzeMeshTopologyImpact(project, 'nonexistent', 0);
    expect(impact.vertexCountChanged).toBe(false);
    expect(impact.blendShapeIds).toEqual([]);
    expect(impact.meshTrackAddresses).toEqual([]);
    expect(impact.hasWeights).toBe(false);
  });

  it('detects no weights when influences and boneWeights are absent', () => {
    const project = cloneProject();
    const node = project.nodes.find(n => n.id === 'face');
    delete node.mesh.influences;
    delete node.mesh.boneWeights;
    const impact = analyzeMeshTopologyImpact(project, 'face', 4);
    expect(impact.hasWeights).toBe(false);
  });

  it('finds multiple mesh_verts tracks across animations', () => {
    const project = cloneProject();
    project.animations.push({
      id: 'anim-walk',
      name: 'Walk',
      duration: 500,
      fps: 24,
      tracks: [
        { targetId: 'face', property: 'mesh_verts', keyframes: [] },
      ],
    });
    const impact = analyzeMeshTopologyImpact(project, 'face', 4);
    expect(impact.meshTrackAddresses).toHaveLength(2);
    expect(impact.meshTrackAddresses[1]).toEqual({ animationId: 'anim-walk', trackIndex: 0 });
  });
});

describe('applyMeshTopologyChange — add', () => {
  it('adds a vertex and extends all vertex-dependent arrays', () => {
    const project = cloneProject();
    const before = project.nodes.find(n => n.id === 'face');
    const oldCount = before.mesh.vertices.length;

    const result = applyMeshTopologyChange(project, 'face', {
      type: 'add',
      vertex: { x: 50, y: 50 },
      imageWidth: 100,
      imageHeight: 100,
    });

    expect(result.summary.changed).toBe(true);
    expect(result.summary.operation).toBe('add');
    expect(result.summary.vertexCountDelta).toBe(1);

    const node = project.nodes.find(n => n.id === 'face');
    expect(node.mesh.vertices.length).toBe(oldCount + 1);
    expect(node.mesh.uvs.length).toBe((oldCount + 1) * 2);
    expect(node.mesh.influences.length).toBe(oldCount + 1);
    expect(node.mesh.influences[oldCount]).toEqual([]);
    expect(node.mesh.boneWeights.length).toBe(oldCount + 1);
    expect(node.blendShapes[0].deltas.length).toBe(oldCount + 1);
    expect(node.blendShapes[0].deltas[oldCount]).toEqual({ dx: 0, dy: 0 });
  });

  it('extends mesh_verts track keyframes with same vertex count', () => {
    const project = cloneProject();
    const track = project.animations[0].tracks.find(t => t.property === 'mesh_verts');
    const oldKfLen = track.keyframes[0].value.length;

    applyMeshTopologyChange(project, 'face', {
      type: 'add',
      vertex: { x: 50, y: 50 },
      imageWidth: 100,
      imageHeight: 100,
    });

    expect(track.keyframes[0].value.length).toBe(oldKfLen + 1);
  });

  it('returns unchanged for missing node', () => {
    const project = cloneProject();
    const result = applyMeshTopologyChange(project, 'nonexistent', { type: 'add', vertex: { x: 0, y: 0 } });
    expect(result.summary.changed).toBe(false);
  });
});

describe('applyMeshTopologyChange — remove', () => {
  it('removes a vertex and shrinks all vertex-dependent arrays', () => {
    const project = cloneProject();
    const before = project.nodes.find(n => n.id === 'face');
    const oldCount = before.mesh.vertices.length;

    const result = applyMeshTopologyChange(project, 'face', {
      type: 'remove',
      vertexIndex: 1,
    });

    expect(result.summary.changed).toBe(true);
    expect(result.summary.operation).toBe('remove');
    expect(result.summary.vertexCountDelta).toBe(-1);

    const node = project.nodes.find(n => n.id === 'face');
    expect(node.mesh.vertices.length).toBe(oldCount - 1);
    expect(node.mesh.uvs.length).toBe((oldCount - 1) * 2);
    expect(node.mesh.influences.length).toBe(oldCount - 1);
    expect(node.mesh.boneWeights.length).toBe(oldCount - 1);
    expect(node.blendShapes[0].deltas.length).toBe(oldCount - 1);
  });

  it('refuses to remove when vertex count <= 3', () => {
    const project = cloneProject();
    const node = project.nodes.find(n => n.id === 'face');
    node.mesh.vertices = node.mesh.vertices.slice(0, 3);
    node.mesh.uvs = [0, 0, 1, 0, 0, 1];
    node.mesh.influences = [[], [], []];
    node.mesh.boneWeights = [1, 0.5, 0];
    node.blendShapes[0].deltas = node.blendShapes[0].deltas.slice(0, 3);

    const result = applyMeshTopologyChange(project, 'face', { type: 'remove', vertexIndex: 0 });
    expect(result.summary.changed).toBe(false);
  });

  it('refuses invalid vertexIndex', () => {
    const project = cloneProject();
    const result = applyMeshTopologyChange(project, 'face', { type: 'remove', vertexIndex: -1 });
    expect(result.summary.changed).toBe(false);
  });

  it('shrinks mesh_verts track keyframes', () => {
    const project = cloneProject();
    const track = project.animations[0].tracks.find(t => t.property === 'mesh_verts');
    const oldKfLen = track.keyframes[0].value.length;

    applyMeshTopologyChange(project, 'face', { type: 'remove', vertexIndex: 2 });

    expect(track.keyframes[0].value.length).toBe(oldKfLen - 1);
  });
});

describe('applyMeshTopologyChange — remesh', () => {
  it('replaces mesh and clears blend shapes, tracks, and weights', () => {
    const project = cloneProject();
    const newVerts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }];
    const newUvs = [0, 0, 1, 0, 0.5, 1];
    const newTris = [[0, 1, 2]];
    const newEdges = [0, 1, 2];

    const result = applyMeshTopologyChange(project, 'face', {
      type: 'remesh',
      mesh: { vertices: newVerts, uvs: newUvs, triangles: newTris, edgeIndices: newEdges },
      imageWidth: 100,
      imageHeight: 100,
    });

    expect(result.summary.changed).toBe(true);
    expect(result.summary.operation).toBe('remesh');
    expect(result.summary.clearedBlendShapeIds).toEqual(['smile']);
    expect(result.summary.clearedTrackAddresses).toEqual([{ animationId: 'anim-idle', trackIndex: 0 }]);

    const node = project.nodes.find(n => n.id === 'face');
    expect(node.mesh.vertices).toEqual(newVerts);
    expect(node.mesh.uvs).toEqual(newUvs);
    expect(node.mesh.triangles).toEqual(newTris);
    expect(node.blendShapes).toEqual([]);
    expect(node.blendShapeValues).toEqual({});
    expect(node.mesh.influences).toBeUndefined();
    expect(node.mesh.boneWeights).toBeUndefined();

    const anim = project.animations[0];
    expect(anim.tracks.find(t => t.property === 'mesh_verts')).toBeUndefined();
  });

  it('handles Float32Array uvs and Set edgeIndices in input', () => {
    const project = cloneProject();
    const result = applyMeshTopologyChange(project, 'face', {
      type: 'remesh',
      mesh: {
        vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }],
        uvs: new Float32Array([0, 0, 1, 0, 0, 1]),
        triangles: [[0, 1, 2]],
        edgeIndices: new Set([0, 1, 2]),
      },
    });

    expect(result.summary.changed).toBe(true);
    const node = project.nodes.find(n => n.id === 'face');
    expect(Array.isArray(node.mesh.uvs)).toBe(true);
    expect(Array.isArray(node.mesh.edgeIndices)).toBe(true);
  });
});

describe('vertex-dependent length invariants after operations', () => {
  it('add: all vertex-dependent arrays have length = vertices.length', () => {
    const project = cloneProject();
    applyMeshTopologyChange(project, 'face', {
      type: 'add',
      vertex: { x: 50, y: 50 },
      imageWidth: 100,
      imageHeight: 100,
    });
    const node = project.nodes.find(n => n.id === 'face');
    const vc = node.mesh.vertices.length;
    expect(node.mesh.uvs.length).toBe(vc * 2);
    expect(node.mesh.influences.length).toBe(vc);
    expect(node.mesh.boneWeights.length).toBe(vc);
    for (const shape of node.blendShapes) {
      expect(shape.deltas.length).toBe(vc);
    }
  });

  it('remove: all vertex-dependent arrays have length = vertices.length', () => {
    const project = cloneProject();
    applyMeshTopologyChange(project, 'face', { type: 'remove', vertexIndex: 1 });
    const node = project.nodes.find(n => n.id === 'face');
    const vc = node.mesh.vertices.length;
    expect(node.mesh.uvs.length).toBe(vc * 2);
    expect(node.mesh.influences.length).toBe(vc);
    expect(node.mesh.boneWeights.length).toBe(vc);
    for (const shape of node.blendShapes) {
      expect(shape.deltas.length).toBe(vc);
    }
  });

  it('remesh: no stale vertex-dependent data remains', () => {
    const project = cloneProject();
    applyMeshTopologyChange(project, 'face', {
      type: 'remesh',
      mesh: {
        vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }],
        uvs: [0, 0, 1, 0, 0.5, 1],
        triangles: [[0, 1, 2]],
        edgeIndices: [0, 1, 2],
      },
    });
    const node = project.nodes.find(n => n.id === 'face');
    const vc = node.mesh.vertices.length;
    expect(node.mesh.uvs.length).toBe(vc * 2);
    expect(node.blendShapes).toEqual([]);
    expect(node.mesh.influences).toBeUndefined();
    expect(node.mesh.boneWeights).toBeUndefined();
  });
});
