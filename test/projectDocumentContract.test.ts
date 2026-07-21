import { describe, it, expect } from 'vitest';
import { validateProject, parseProject, CURRENT_PROJECT_VERSION } from '../src/schema/projectSchema';
import { createGoldenProject, createGoldenPortable } from './fixtures/goldenProject';
import { createEmptyProject } from '../src/core/createEmptyProject';
import { PERSISTED_PROJECT_FIELDS } from '../src/schema/projectDocumentAdapter';
import { assertJsonSafe, createPortableProjectSnapshot } from '../src/schema/projectSnapshot';
import { prepareLoadedProjectDocument } from '../src/schema/projectDocumentAdapter';

describe('projectDocument contract', () => {
  describe('golden fixture validation (A1)', () => {
    it('golden runtime validates against schema', () => {
      const project = createGoldenProject();
      const result = validateProject(project);
      expect(result.success).toBe(true);
    });

    it('golden portable validates against schema', () => {
      const project = createGoldenPortable();
      const result = validateProject(project);
      expect(result.success).toBe(true);
    });

    it('golden project round-trips through parseProject', () => {
      const project = createGoldenProject();
      const parsed = parseProject(project);
      expect(parsed.version).toBe(CURRENT_PROJECT_VERSION);
      expect(parsed.nodes).toHaveLength(3);
      expect(parsed.animations).toHaveLength(1);
    });
  });

  describe('JSON-safety (C5)', () => {
    it('golden portable contains no TypedArrays, Sets, Maps, or non-JSON values', () => {
      const portable = createGoldenPortable();
      const serialized = JSON.stringify(portable);
      const reparsed = JSON.parse(serialized) as unknown;
      expect(reparsed).toEqual(portable);
    });

    it('golden portable has no undefined values', () => {
      const portable = createGoldenPortable();
      const rejectUndefined = (key: string, value: unknown): unknown => {
        if (value === undefined) throw new Error(`undefined at ${key}`);
        return value;
      };
      const json = JSON.stringify(portable, rejectUndefined);
      expect(() => {
        JSON.parse(json);
      }).not.toThrow();
    });

    it('rejects values that JSON cannot preserve', () => {
      expect(() => assertJsonSafe(undefined)).toThrow('undefined at $');
      expect(() => assertJsonSafe(Number.NaN)).toThrow('Non-finite number');
      expect(() => assertJsonSafe(1n)).toThrow('bigint');
      expect(() => assertJsonSafe(() => undefined)).toThrow('function');
    });

    it('rejects circular objects with a controlled error', () => {
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      expect(() => assertJsonSafe(circular)).toThrow('Circular reference at $.self');
    });
  });

  describe('K2 to K3 normalization', () => {
    it('normalizes a validated string version to the numeric runtime contract', () => {
      const validated = parseProject({ ...createGoldenProject(), version: String(CURRENT_PROJECT_VERSION) });
      const normalized = prepareLoadedProjectDocument(validated);
      expect(normalized.version).toBe(CURRENT_PROJECT_VERSION);
      expect(typeof normalized.version).toBe('number');
    });
  });

  describe('persisted key parity', () => {
    it('PERSISTED_PROJECT_FIELDS matches createEmptyProject top-level keys', () => {
      expect(PERSISTED_PROJECT_FIELDS).toEqual(Object.keys(createEmptyProject()));
    });

    it('createEmptyProject validates against schema', () => {
      const project = createEmptyProject();
      const result = validateProject(project);
      expect(result.success).toBe(true);
    });

    it('portable snapshot uses the canonical persisted field set', () => {
      const snapshot = createPortableProjectSnapshot(createGoldenProject());
      expect(Object.keys(snapshot).sort()).toEqual([...PERSISTED_PROJECT_FIELDS].sort());
    });

    it('runtime-only top-level keys do not enter portable snapshot', () => {
      const project = createGoldenProject() as Record<string, unknown>;
      project.__runtimeOnly = true;
      const snapshot = createPortableProjectSnapshot(project as Parameters<typeof createPortableProjectSnapshot>[0]);
      expect((snapshot as Record<string, unknown>).__runtimeOnly).toBeUndefined();
      expect(Object.prototype.hasOwnProperty.call(snapshot, '__runtimeOnly')).toBe(false);
    });
  });

  describe('mesh invariant rejections', () => {
    function makeProjectWithMesh(meshOverrides: Record<string, unknown>) {
      const project = createGoldenProject();
      const faceNode = project.nodes.find(n => n.id === 'face')!;
      Object.assign(faceNode.mesh, meshOverrides);
      return project;
    }

    it('rejects mesh with triangle index out of range', () => {
      const project = makeProjectWithMesh({ triangles: [[0, 1, 99]] });
      const result = validateProject(project);
      expect(result.success).toBe(false);
      const issues = result.error!.issues;
      const issue = issues.find(i => i.path.includes('triangles'));
      expect(issue).toBeDefined();
      expect(issue!.message).toContain('out of range');
    });

    it('rejects mesh with negative triangle index', () => {
      const project = makeProjectWithMesh({ triangles: [[-1, 1, 2]] });
      const result = validateProject(project);
      expect(result.success).toBe(false);
    });

    it('rejects mesh with UV count mismatch', () => {
      const project = makeProjectWithMesh({ uvs: [0, 0, 1, 0] });
      const result = validateProject(project);
      expect(result.success).toBe(false);
      const issues = result.error!.issues;
      const issue = issues.find(i => i.path.includes('uvs'));
      expect(issue).toBeDefined();
      expect(issue!.message).toContain('UV count');
    });

    it('rejects mesh with boneWeights length mismatch', () => {
      const project = makeProjectWithMesh({ boneWeights: [1, 0.5] });
      const result = validateProject(project);
      expect(result.success).toBe(false);
      const issues = result.error!.issues;
      const issue = issues.find(i => i.path.includes('boneWeights'));
      expect(issue).toBeDefined();
      expect(issue!.message).toContain('boneWeights length');
    });

    it('rejects mesh with influences length mismatch', () => {
      const project = makeProjectWithMesh({ influences: [[{ boneId: 'b1', weight: 1 }]] });
      const result = validateProject(project);
      expect(result.success).toBe(false);
      const issues = result.error!.issues;
      const issue = issues.find(i => i.path.includes('influences'));
      expect(issue).toBeDefined();
      expect(issue!.message).toContain('influences length');
    });

    it('rejects mesh vertex with NaN', () => {
      const project = createGoldenProject();
      const faceNode = project.nodes.find(n => n.id === 'face')!;
      (faceNode.mesh as Record<string, unknown>).vertices[0] = { x: NaN, y: 0 };
      const result = validateProject(project);
      expect(result.success).toBe(false);
    });

    it('rejects mesh with non-integer triangle index', () => {
      const project = makeProjectWithMesh({ triangles: [[0.5, 1, 2]] });
      const result = validateProject(project);
      expect(result.success).toBe(false);
    });
  });

  describe('blendShapes invariant', () => {
    it('rejects blendShape deltas length mismatch with vertex count', () => {
      const project = createGoldenProject();
      const faceNode = project.nodes.find(n => n.id === 'face')!;
      (faceNode.blendShapes[0] as Record<string, unknown>).deltas = [{ dx: 1, dy: 0 }];
      const result = validateProject(project);
      expect(result.success).toBe(false);
      const issues = result.error!.issues;
      const issue = issues.find(i =>
        i.path.includes('blendShapes') && i.path.includes('deltas'),
      );
      expect(issue).toBeDefined();
      expect(issue!.message).toContain('deltas length');
    });
  });

  describe('mesh shape contract (K1)', () => {
    it('vertices are objects with x,y and optional restX,restY', () => {
      const project = createGoldenProject();
      const faceNode = project.nodes.find(n => n.id === 'face')!;
      const v = faceNode.mesh.vertices[0]!;
      expect(v).toHaveProperty('x');
      expect(v).toHaveProperty('y');
      expect(v).toHaveProperty('restX');
      expect(v).toHaveProperty('restY');
      expect(typeof v.x).toBe('number');
      expect(typeof v.y).toBe('number');
    });

    it('triangles are triples of integers', () => {
      const project = createGoldenProject();
      const faceNode = project.nodes.find(n => n.id === 'face')!;
      for (const tri of faceNode.mesh.triangles) {
        expect(tri).toHaveLength(3);
        tri.forEach(idx => {
          expect(Number.isInteger(idx)).toBe(true);
        });
      }
    });

    it('uvs are flat number array with length = vertices.length * 2', () => {
      const project = createGoldenProject();
      const faceNode = project.nodes.find(n => n.id === 'face')!;
      expect(Array.isArray(faceNode.mesh.uvs)).toBe(true);
      expect(faceNode.mesh.uvs.length).toBe(faceNode.mesh.vertices.length * 2);
    });

    it('edgeIndices are flat integer array', () => {
      const project = createGoldenProject();
      const faceNode = project.nodes.find(n => n.id === 'face')!;
      expect(Array.isArray(faceNode.mesh.edgeIndices)).toBe(true);
      faceNode.mesh.edgeIndices.forEach((idx: unknown) => {
        expect(Number.isInteger(idx)).toBe(true);
      });
    });
  });

  describe('runtime/portable conversion', () => {
    it('golden portable is deep-equal to golden runtime for JSON-safe fields', () => {
      const runtime = createGoldenProject();
      const portable = createGoldenPortable();
      expect(portable).toEqual(runtime);
    });
  });

  describe('mesh_verts track values', () => {
    it('golden mesh_verts keyframe values are finite {x,y} arrays', () => {
      const project = createGoldenProject();
      const anim = project.animations[0]!;
      const meshTrack = anim.tracks.find(t => t.property === 'mesh_verts')!;
      expect(meshTrack).toBeTruthy();
      for (const kf of meshTrack.keyframes) {
        expect(Array.isArray(kf.value)).toBe(true);
        for (const pt of kf.value as Array<Record<string, unknown>>) {
          expect(Number.isFinite(pt.x)).toBe(true);
          expect(Number.isFinite(pt.y)).toBe(true);
        }
      }
    });
  });

  describe('auto-motion schema validation', () => {
    it('valid control handle passes schema', () => {
      const project = createGoldenProject() as Record<string, unknown>;
      const handles = project.controlHandles as unknown[];
      handles.push({
        id: 'ch1', name: 'Chest Handle', role: 'chest',
        space: 'node-local',
        target: { kind: 'part', id: 'face' },
        position: { x: 50, y: 50 },
      });
      const result = validateProject(project);
      expect(result.success).toBe(true);
    });

    it('valid animation modifier passes schema', () => {
      const project = createGoldenProject() as Record<string, unknown>;
      const modifiers = project.animationModifiers as unknown[];
      modifiers.push({
        id: 'm1', name: 'Idle Breathing', presetId: 'builtin.idleBreathing', presetVersion: 1,
        enabled: true, order: 0, scope: 'project', category: 'loop',
        driver: { kind: 'time', periodMs: 2000, phase: 0, curve: 'sine' },
        bindings: {}, outputs: [], params: {},
      });
      const result = validateProject(project);
      expect(result.success).toBe(true);
    });

    it('rejects control handle with invalid space', () => {
      const project = createGoldenProject() as Record<string, unknown>;
      const handles = project.controlHandles as unknown[];
      handles.push({
        id: 'ch1', name: 'Bad', role: 'chest',
        space: 'invalid-space',
        target: { kind: 'part', id: 'face' },
        position: { x: 0, y: 0 },
      });
      const result = validateProject(project);
      expect(result.success).toBe(false);
    });

    it('accepts boneMotion driver kind', () => {
      const project = createGoldenProject() as Record<string, unknown>;
      const modifiers = project.animationModifiers as unknown[];
      modifiers.push({
        id: 'm-bm', name: 'Head Cheek Jiggle', presetId: 'builtin.cheekJiggle', presetVersion: 1,
        enabled: true, order: 1, scope: 'project', category: 'reaction',
        driver: { kind: 'boneMotion', sourceBoneId: 'b1', axes: ['x', 'y'], gain: 0.5 },
        bindings: {}, outputs: [], params: {},
      });
      const result = validateProject(project);
      expect(result.success).toBe(true);
    });

    it('rejects boneMotion driver with missing sourceBoneId', () => {
      const project = createGoldenProject() as Record<string, unknown>;
      const modifiers = project.animationModifiers as unknown[];
      modifiers.push({
        id: 'm-bm', name: 'Bad', presetId: 'builtin.cheekJiggle', presetVersion: 1,
        enabled: true, order: 0, scope: 'project', category: 'reaction',
        driver: { kind: 'boneMotion', axes: ['x'], gain: 1 },
        bindings: {}, outputs: [], params: {},
      });
      const result = validateProject(project);
      expect(result.success).toBe(false);
    });

    it('rejects boneMotion driver with non-finite gain', () => {
      const project = createGoldenProject() as Record<string, unknown>;
      const modifiers = project.animationModifiers as unknown[];
      modifiers.push({
        id: 'm-bm', name: 'Bad', presetId: 'builtin.cheekJiggle', presetVersion: 1,
        enabled: true, order: 0, scope: 'project', category: 'reaction',
        driver: { kind: 'boneMotion', sourceBoneId: 'b1', axes: ['x'], gain: NaN },
        bindings: {}, outputs: [], params: {},
      });
      const result = validateProject(project);
      expect(result.success).toBe(false);
    });

    it('rejects boneMotion driver with empty axes', () => {
      const project = createGoldenProject() as Record<string, unknown>;
      const modifiers = project.animationModifiers as unknown[];
      modifiers.push({
        id: 'm-bm', name: 'Bad', presetId: 'builtin.cheekJiggle', presetVersion: 1,
        enabled: true, order: 0, scope: 'project', category: 'reaction',
        driver: { kind: 'boneMotion', sourceBoneId: 'b1', axes: [], gain: 1 },
        bindings: {}, outputs: [], params: {},
      });
      const result = validateProject(project);
      expect(result.success).toBe(true);
    });

    it('rejects modifier with missing required fields', () => {
      const project = createGoldenProject() as Record<string, unknown>;
      const modifiers = project.animationModifiers as unknown[];
      modifiers.push({
        id: 'm1', name: 'Broken',
      });
      const result = validateProject(project);
      expect(result.success).toBe(false);
    });

    it('rejects modifier with non-positive periodMs', () => {
      const project = createGoldenProject() as Record<string, unknown>;
      const modifiers = project.animationModifiers as unknown[];
      modifiers.push({
        id: 'm1', name: 'Bad', presetId: 'builtin.idleBreathing', presetVersion: 1,
        enabled: true, order: 0, scope: 'project', category: 'loop',
        driver: { kind: 'time', periodMs: -100, phase: 0, curve: 'sine' },
        bindings: {}, outputs: [], params: {},
      });
      const result = validateProject(project);
      expect(result.success).toBe(false);
    });

    it('rejects control handle with non-finite position', () => {
      const project = createGoldenProject() as Record<string, unknown>;
      const handles = project.controlHandles as unknown[];
      handles.push({
        id: 'ch1', name: 'Bad', role: 'chest',
        space: 'node-local',
        target: { kind: 'part', id: 'face' },
        position: { x: NaN, y: 0 },
      });
      const result = validateProject(project);
      expect(result.success).toBe(false);
    });
  });

  describe('defaultPose presence (P2)', () => {
    it('golden project has non-empty defaultPose', () => {
      const project = createGoldenProject();
      expect(Object.keys(project.defaultPose as Record<string, unknown>).length).toBeGreaterThan(0);
    });

    it('schema accepts defaultPose', () => {
      const project = createGoldenProject();
      const result = validateProject(project);
      expect(result.success).toBe(true);
      expect((result.data as Record<string, unknown>).defaultPose).toEqual(
        (project as Record<string, unknown>).defaultPose,
      );
    });
  });
});
