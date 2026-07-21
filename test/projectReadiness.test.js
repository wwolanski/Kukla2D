import { describe, expect, it } from 'vitest';
import { analyzeProjectReadiness } from '@/domain/projectReadiness.js';
import { createGoldenProject } from './fixtures/goldenProject';

function makeMinimalProject() {
  return {
    version: 6,
    canvas: { width: 100, height: 100, x: 0, y: 0, bgEnabled: false, bgColor: '#000' },
    textures: [],
    nodes: [],
    animations: [],
    controlHandles: [],
    animationModifiers: [],
  };
}

describe('analyzeProjectReadiness', () => {
  describe('golden project', () => {
    it('has zero errors for stretch target', () => {
      const golden = createGoldenProject();
      const report = analyzeProjectReadiness(golden, 'stretch');
      expect(report.errors).toEqual([]);
    });

    it('has zero errors for frames target', () => {
      const golden = createGoldenProject();
      const report = analyzeProjectReadiness(golden, 'frames');
      expect(report.errors).toEqual([]);
    });

    it('has warnings for spine target (BRAK DANYCH)', () => {
      const golden = createGoldenProject();
      const report = analyzeProjectReadiness(golden, 'spine');
      expect(report.errors).toEqual([]);
      expect(report.warnings.length).toBeGreaterThan(0);
      expect(report.warnings[0].message).toContain('BRAK DANYCH');
    });

    it('has warnings for live2d target (BRAK DANYCH)', () => {
      const golden = createGoldenProject();
      const report = analyzeProjectReadiness(golden, 'live2d');
      expect(report.errors).toEqual([]);
      expect(report.warnings.length).toBeGreaterThan(0);
    });

    it('has warnings for live2d_project target (BRAK DANYCH)', () => {
      const golden = createGoldenProject();
      const report = analyzeProjectReadiness(golden, 'live2d_project');
      expect(report.errors).toEqual([]);
      expect(report.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('DOCUMENT_INVALID', () => {
    it('detects missing canvas fields', () => {
      const project = makeMinimalProject();
      project.canvas = { width: 100 };
      const report = analyzeProjectReadiness(project, 'stretch');
      expect(report.errors.some(e => e.code === 'DOCUMENT_INVALID')).toBe(true);
    });

    it('detects bad mesh UV count', () => {
      const project = createGoldenProject();
      project.nodes[1].mesh.uvs = [0, 0, 1, 0];
      const report = analyzeProjectReadiness(project, 'stretch');
      expect(report.errors.some(e => e.code === 'DOCUMENT_INVALID')).toBe(true);
    });

    it('detects bad triangle index', () => {
      const project = createGoldenProject();
      project.nodes[1].mesh.triangles = [[0, 1, 99]];
      const report = analyzeProjectReadiness(project, 'stretch');
      expect(report.errors.some(e => e.code === 'DOCUMENT_INVALID')).toBe(true);
    });

    it('detects bad blendShape deltas length', () => {
      const project = createGoldenProject();
      project.nodes[1].blendShapes[0].deltas = [{ dx: 0, dy: 0 }];
      const report = analyzeProjectReadiness(project, 'stretch');
      expect(report.errors.some(e => e.code === 'DOCUMENT_INVALID')).toBe(true);
    });
  });

  describe('ASSET_SOURCE_MISSING', () => {
    it('detects texture with empty source', () => {
      const project = createGoldenProject();
      project.textures[0].source = '';
      const report = analyzeProjectReadiness(project, 'stretch');
      expect(report.errors.some(e => e.code === 'ASSET_SOURCE_MISSING')).toBe(true);
    });

    it('detects audio track with no source', () => {
      const project = createGoldenProject();
      project.animations[0].audioTracks[0].source = '';
      project.animations[0].audioTracks[0].sourceUrl = null;
      const report = analyzeProjectReadiness(project, 'stretch');
      expect(report.errors.some(e => e.code === 'ASSET_SOURCE_MISSING')).toBe(true);
    });
  });

  describe('MESH_TOPOLOGY_INVALID', () => {
    it('detects boneWeights length mismatch', () => {
      const project = createGoldenProject();
      project.nodes[1].mesh.boneWeights = [1];
      const report = analyzeProjectReadiness(project, 'stretch');
      expect(report.errors.some(e => e.code === 'MESH_TOPOLOGY_INVALID')).toBe(true);
    });

    it('detects influences length mismatch', () => {
      const project = createGoldenProject();
      project.nodes[1].mesh.influences = [[{ boneId: 'b1', weight: 1 }]];
      const report = analyzeProjectReadiness(project, 'stretch');
      expect(report.errors.some(e => e.code === 'MESH_TOPOLOGY_INVALID')).toBe(true);
    });
  });

  describe('MESH_TRACK_VERTEX_COUNT_MISMATCH', () => {
    it('detects mesh_verts keyframe with wrong vertex count', () => {
      const project = createGoldenProject();
      project.animations[0].tracks[0].keyframes[0].value = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ];
      const report = analyzeProjectReadiness(project, 'stretch');
      expect(report.errors.some(e => e.code === 'MESH_TRACK_VERTEX_COUNT_MISMATCH')).toBe(true);
    });

    it('passes when mesh_verts keyframe matches vertex count', () => {
      const project = createGoldenProject();
      const report = analyzeProjectReadiness(project, 'stretch');
      expect(report.errors.some(e => e.code === 'MESH_TRACK_VERTEX_COUNT_MISMATCH')).toBe(false);
    });
  });

  describe('DANGLING_TARGET', () => {
    it('detects track referencing nonexistent node', () => {
      const project = createGoldenProject();
      project.animations[0].tracks[0].targetId = 'nonexistent';
      const report = analyzeProjectReadiness(project, 'stretch');
      expect(report.errors.some(e => e.code === 'DANGLING_TARGET')).toBe(true);
    });

    it('detects clipToPartId referencing nonexistent node', () => {
      const project = createGoldenProject();
      project.nodes[1].clipToPartId = 'ghost';
      const report = analyzeProjectReadiness(project, 'stretch');
      expect(report.errors.some(e => e.code === 'DANGLING_TARGET')).toBe(true);
    });

    it('detects skin entry referencing nonexistent slot', () => {
      const project = createGoldenProject();
      project.skins[0].entries[0].slotId = 'ghost-slot';
      const report = analyzeProjectReadiness(project, 'stretch');
      expect(report.errors.some(e => e.code === 'DANGLING_TARGET')).toBe(true);
    });
  });

  describe('CAPTURE_REQUEST_UNSUPPORTED', () => {
    it('detects unknown target', () => {
      const project = createGoldenProject();
      const report = analyzeProjectReadiness(project, 'unknown_target');
      expect(report.errors.some(e => e.code === 'CAPTURE_REQUEST_UNSUPPORTED')).toBe(true);
    });

    it('detects frames target with no animations', () => {
      const project = makeMinimalProject();
      const report = analyzeProjectReadiness(project, 'frames');
      expect(report.errors.some(e => e.code === 'CAPTURE_REQUEST_UNSUPPORTED')).toBe(true);
    });
  });

  describe('issue stability', () => {
    it('same problem produces same code across targets', () => {
      const project = createGoldenProject();
      project.textures[0].source = '';

      const stretchReport = analyzeProjectReadiness(project, 'stretch');
      const framesReport = analyzeProjectReadiness(project, 'frames');

      const stretchAssetErrors = stretchReport.errors.filter(e => e.code === 'ASSET_SOURCE_MISSING');
      const framesAssetErrors = framesReport.errors.filter(e => e.code === 'ASSET_SOURCE_MISSING');

      expect(stretchAssetErrors.length).toBe(1);
      expect(framesAssetErrors.length).toBe(1);
      expect(stretchAssetErrors[0].code).toBe(framesAssetErrors[0].code);
      expect(stretchAssetErrors[0].path).toBe(framesAssetErrors[0].path);
    });

    it('issues have code, path, message fields', () => {
      const project = createGoldenProject();
      project.textures[0].source = '';
      const report = analyzeProjectReadiness(project, 'stretch');
      const issue = report.errors.find(e => e.code === 'ASSET_SOURCE_MISSING');
      expect(issue).toBeDefined();
      expect(issue.code).toBe('ASSET_SOURCE_MISSING');
      expect(typeof issue.path).toBe('string');
      expect(typeof issue.message).toBe('string');
    });
  });

  describe('pure function — no side effects', () => {
    it('does not mutate the project', () => {
      const project = createGoldenProject();
      const before = JSON.stringify(project);
      analyzeProjectReadiness(project, 'stretch');
      const after = JSON.stringify(project);
      expect(after).toBe(before);
    });
  });

  describe('minimal valid project', () => {
    it('has zero errors for stretch', () => {
      const project = makeMinimalProject();
      const report = analyzeProjectReadiness(project, 'stretch');
      expect(report.errors).toEqual([]);
    });
  });

  describe('auto-motion readiness warnings', () => {
    it('reports DANGLING_MODIFIER_TARGET for missing control handle role', () => {
      const project = createGoldenProject();
      project.controlHandles = [];
      project.animationModifiers = [{
        id: 'm1', name: 'Idle', presetId: 'builtin.idleBreathing', presetVersion: 1,
        enabled: true, order: 0, scope: 'project', category: 'loop',
        driver: { kind: 'time', periodMs: 2000, phase: 0, curve: 'sine' },
        bindings: { chest: { role: 'chest', required: true, target: 'handle' } },
        outputs: [], params: {},
      }];
      const report = analyzeProjectReadiness(project, 'stretch');
      expect(report.warnings.some(w => w.code === 'DANGLING_MODIFIER_TARGET')).toBe(true);
    });

    it('reports MODIFIER_MESH_TOPOLOGY_MISMATCH for blendShape deltas length mismatch', () => {
      const project = createGoldenProject();
      const node = project.nodes.find(n => n.type === 'part' && n.blendShapes?.length > 0);
      if (node) {
        node.blendShapes[0].deltas = [{ dx: 0, dy: 0 }];
        project.animationModifiers = [{
          id: 'm1', name: 'Idle', presetId: 'builtin.idleBreathing', presetVersion: 1,
          enabled: true, order: 0, scope: 'project', category: 'loop',
          driver: { kind: 'time', periodMs: 2000, phase: 0, curve: 'sine' },
          bindings: {}, outputs: [
            { kind: 'blendShapeValue', targetId: node.id, property: node.blendShapes[0].id },
          ], params: {},
        }];
        const report = analyzeProjectReadiness(project, 'stretch');
        expect(report.warnings.some(w => w.code === 'MODIFIER_MESH_TOPOLOGY_MISMATCH')).toBe(true);
      }
    });

    it('reports DANGLING_CONTROL_HANDLE_TARGET for unknown node target', () => {
      const project = createGoldenProject();
      project.controlHandles = [{
        id: 'ch1', name: 'Handle', role: 'chest',
        space: 'node-local',
        target: { kind: 'part', id: 'nonexistent' },
        position: { x: 0, y: 0 },
      }];
      const report = analyzeProjectReadiness(project, 'stretch');
      expect(report.warnings.some(w => w.code === 'DANGLING_CONTROL_HANDLE_TARGET')).toBe(true);
    });

    it('reports DANGLING_CONTROL_HANDLE_TARGET for unknown bone target', () => {
      const project = createGoldenProject();
      project.controlHandles = [{
        id: 'ch1', name: 'Handle', role: 'chest',
        space: 'node-local',
        target: { kind: 'bone', id: 'nonexistent-bone' },
        position: { x: 0, y: 0 },
      }];
      const report = analyzeProjectReadiness(project, 'stretch');
      expect(report.warnings.some(w => w.code === 'DANGLING_CONTROL_HANDLE_TARGET')).toBe(true);
    });

    it('reports MODIFIER_PRESET_UNKNOWN for unknown preset', () => {
      const project = createGoldenProject();
      project.animationModifiers = [{
        id: 'm1', name: 'Test', presetId: 'unknown.preset', presetVersion: 1,
        enabled: true, order: 0, scope: 'project', category: 'loop',
        driver: { kind: 'time', periodMs: 2000, phase: 0, curve: 'sine' },
        bindings: {}, outputs: [], params: {},
      }];
      const report = analyzeProjectReadiness(project, 'stretch');
      expect(report.warnings.some(w => w.code === 'MODIFIER_PRESET_UNKNOWN')).toBe(true);
    });

    it('reports MODIFIER_BLENDSHAPE_MISSING for missing blendShape on target', () => {
      const project = createGoldenProject();
      project.animationModifiers = [{
        id: 'm1', name: 'Idle', presetId: 'builtin.idleBreathing', presetVersion: 1,
        enabled: true, order: 0, scope: 'project', category: 'loop',
        driver: { kind: 'time', periodMs: 2000, phase: 0, curve: 'sine' },
        bindings: {}, outputs: [
          { kind: 'blendShapeValue', targetId: 'face', property: 'nonexistent_shape' },
        ], params: {},
      }];
      const report = analyzeProjectReadiness(project, 'stretch');
      expect(report.warnings.some(w => w.code === 'MODIFIER_BLENDSHAPE_MISSING')).toBe(true);
    });

    it('reports MODIFIER_OUTPUT_TARGET_MISSING for missing node', () => {
      const project = createGoldenProject();
      project.animationModifiers = [{
        id: 'm1', name: 'Idle', presetId: 'builtin.idleBreathing', presetVersion: 1,
        enabled: true, order: 0, scope: 'project', category: 'loop',
        driver: { kind: 'time', periodMs: 2000, phase: 0, curve: 'sine' },
        bindings: {}, outputs: [
          { kind: 'blendShapeValue', targetId: 'ghost', property: 'smile' },
        ], params: {},
      }];
      const report = analyzeProjectReadiness(project, 'stretch');
      expect(report.warnings.some(w => w.code === 'MODIFIER_OUTPUT_TARGET_MISSING')).toBe(true);
    });

    it('passes golden project without auto-motion warnings', () => {
      const project = createGoldenProject();
      const report = analyzeProjectReadiness(project, 'stretch');
      const autoMotionCodes = ['DANGLING_CONTROL_HANDLE_TARGET', 'DANGLING_MODIFIER_TARGET',
        'MODIFIER_PRESET_UNKNOWN', 'MODIFIER_OUTPUT_TARGET_MISSING', 'MODIFIER_BLENDSHAPE_MISSING',
        'MODIFIER_MESH_TOPOLOGY_MISMATCH'];
      for (const code of autoMotionCodes) {
        expect(report.warnings.some(w => w.code === code)).toBe(false);
      }
    });

    it('does not report MODIFIER_PRESET_UNKNOWN for headCheekJiggle preset', () => {
      const project = createGoldenProject();
      project.animationModifiers = [{
        id: 'm1', name: 'Head Cheek Jiggle', presetId: 'builtin.headCheekJiggle', presetVersion: 1,
        enabled: true, order: 0, scope: 'project', category: 'reaction',
        driver: { kind: 'boneMotion', sourceBoneId: 'b1', axes: ['x', 'y'], gain: 0.5 },
        bindings: {}, outputs: [], params: {},
      }];
      const report = analyzeProjectReadiness(project, 'stretch');
      expect(report.warnings.some(w => w.code === 'MODIFIER_PRESET_UNKNOWN')).toBe(false);
    });

    it('reports DANGLING_MODIFIER_TARGET for missing source bone in boneMotion driver', () => {
      const project = createGoldenProject();
      project.animationModifiers = [{
        id: 'm1', name: 'Head Cheek Jiggle', presetId: 'builtin.headCheekJiggle', presetVersion: 1,
        enabled: true, order: 0, scope: 'project', category: 'reaction',
        driver: { kind: 'boneMotion', sourceBoneId: 'nonexistent-bone', axes: ['x'], gain: 0.5 },
        bindings: {}, outputs: [], params: {},
      }];
      const report = analyzeProjectReadiness(project, 'stretch');
      expect(report.warnings.some(w => w.code === 'DANGLING_MODIFIER_TARGET')).toBe(true);
      expect(report.warnings.some(w => w.message.includes('source bone'))).toBe(true);
    });

    it('does not report DANGLING_MODIFIER_TARGET when source bone exists', () => {
      const project = createGoldenProject();
      project.animationModifiers = [{
        id: 'm1', name: 'Head Cheek Jiggle', presetId: 'builtin.headCheekJiggle', presetVersion: 1,
        enabled: true, order: 0, scope: 'project', category: 'reaction',
        driver: { kind: 'boneMotion', sourceBoneId: 'b1', axes: ['x', 'y'], gain: 0.5 },
        bindings: {}, outputs: [], params: {},
      }];
      const report = analyzeProjectReadiness(project, 'stretch');
      expect(report.warnings.filter(w => w.code === 'DANGLING_MODIFIER_TARGET')).toHaveLength(0);
    });

    it('reports MODIFIER_MESH_TOPOLOGY_MISMATCH for head cheek jiggle blendShape', () => {
      const project = createGoldenProject();
      const node = project.nodes.find(n => n.type === 'part' && n.blendShapes?.length > 0);
      if (node) {
        node.blendShapes[0].deltas = [{ dx: 0, dy: 0 }];
        project.animationModifiers = [{
          id: 'm1', name: 'Head Cheek Jiggle', presetId: 'builtin.headCheekJiggle', presetVersion: 1,
          enabled: true, order: 0, scope: 'project', category: 'reaction',
          driver: { kind: 'boneMotion', sourceBoneId: 'b1', axes: ['x'], gain: 0.5 },
          bindings: {}, outputs: [
            { kind: 'blendShapeValue', targetId: node.id, property: node.blendShapes[0].id },
          ], params: {},
        }];
        const report = analyzeProjectReadiness(project, 'stretch');
        expect(report.warnings.some(w => w.code === 'MODIFIER_MESH_TOPOLOGY_MISMATCH')).toBe(true);
      }
    });
  });
});
