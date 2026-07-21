import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { editorModePolicy, ACTION_IDS, REASON_CODES } from '@/domain/editorModePolicy.js';
import { getFeedback } from '@/domain/editorModeFeedback.js';

describe('structural guards — stage 04', () => {

  describe('G4: all structural actions blocked in Animation', () => {
    const STRUCTURAL_ACTIONS = [
      [ACTION_IDS.BONE_CREATE, 'bone'],
      [ACTION_IDS.BONE_DELETE, 'bone'],
      [ACTION_IDS.BONE_REPARENT, 'bone'],
      [ACTION_IDS.IK_CREATE, 'constraint'],
      [ACTION_IDS.IK_ASSIGN, 'constraint'],
      [ACTION_IDS.REMESH, 'node'],
      [ACTION_IDS.WEIGHTS_EDIT, 'node'],
      [ACTION_IDS.LINK_TOGGLE, 'node'],
      [ACTION_IDS.BIND_TOGGLE, 'node'],
      [ACTION_IDS.SLOT_CREATE, 'slot'],
      [ACTION_IDS.SLOT_DELETE, 'slot'],
      [ACTION_IDS.HIERARCHY_REORDER, 'node'],
    ];

    it.each(STRUCTURAL_ACTIONS)('blocks %s in animation mode', (actionId, targetKind) => {
      const decision = editorModePolicy({ mode: 'animation', actionId, targetKind });
      expect(decision.allowed).toBe(false);
      expect(decision.channel).toBe('blocked');
      expect(decision.reasonCode).toBe(REASON_CODES.STAGING_ONLY_STRUCTURE);
    });

    it.each(STRUCTURAL_ACTIONS)('allows %s in staging mode', (actionId, targetKind) => {
      const decision = editorModePolicy({ mode: 'staging', actionId, targetKind });
      expect(decision.allowed).toBe(true);
      expect(decision.channel).toBe('setup-structure');
    });
  });

  describe('A8: Draw Bone/IK/Weights blocked in Animation', () => {
    it('blocks bone.create for tool target in animation', () => {
      const decision = editorModePolicy({ mode: 'animation', actionId: ACTION_IDS.BONE_CREATE, targetKind: 'tool' });
      expect(decision.allowed).toBe(false);
      expect(decision.reasonCode).toBe(REASON_CODES.STAGING_ONLY_STRUCTURE);
    });

    it('blocks ik.create for tool target in animation', () => {
      const decision = editorModePolicy({ mode: 'animation', actionId: ACTION_IDS.IK_CREATE, targetKind: 'tool' });
      expect(decision.allowed).toBe(false);
      expect(decision.reasonCode).toBe(REASON_CODES.STAGING_ONLY_STRUCTURE);
    });

    it('blocks weights.edit for tool target in animation', () => {
      const decision = editorModePolicy({ mode: 'animation', actionId: ACTION_IDS.WEIGHTS_EDIT, targetKind: 'tool' });
      expect(decision.allowed).toBe(false);
      expect(decision.reasonCode).toBe(REASON_CODES.STAGING_ONLY_STRUCTURE);
    });

    it('allows bone.create in staging', () => {
      const decision = editorModePolicy({ mode: 'staging', actionId: ACTION_IDS.BONE_CREATE, targetKind: 'tool' });
      expect(decision.allowed).toBe(true);
    });

    it('allows ik.create in staging', () => {
      const decision = editorModePolicy({ mode: 'staging', actionId: ACTION_IDS.IK_CREATE, targetKind: 'tool' });
      expect(decision.allowed).toBe(true);
    });

    it('allows weights.edit in staging', () => {
      const decision = editorModePolicy({ mode: 'staging', actionId: ACTION_IDS.WEIGHTS_EDIT, targetKind: 'tool' });
      expect(decision.allowed).toBe(true);
    });
  });

  describe('A9: structural actions produce correct feedback', () => {
    it('structure feedback explains staging-only', () => {
      const feedback = getFeedback(REASON_CODES.STAGING_ONLY_STRUCTURE);
      expect(feedback.message).toContain('locked');
      expect(feedback.tooltip).toContain('Staging');
      expect(feedback.suggestedAction).toContain('Staging');
    });

    it('every blocked action has a feedback entry', () => {
      const blockedIds = [
        ACTION_IDS.BONE_CREATE, ACTION_IDS.BONE_DELETE, ACTION_IDS.BONE_REPARENT,
        ACTION_IDS.IK_CREATE, ACTION_IDS.IK_ASSIGN,
        ACTION_IDS.REMESH, ACTION_IDS.WEIGHTS_EDIT,
        ACTION_IDS.LINK_TOGGLE, ACTION_IDS.BIND_TOGGLE,
        ACTION_IDS.SLOT_CREATE, ACTION_IDS.SLOT_DELETE,
        ACTION_IDS.HIERARCHY_REORDER,
      ];
      for (const actionId of blockedIds) {
        const decision = editorModePolicy({ mode: 'animation', actionId, targetKind: 'bone' });
        if (!decision.allowed) {
          const feedback = getFeedback(decision.reasonCode);
          expect(feedback.message).toBeTruthy();
          expect(feedback.tooltip).toBeTruthy();
          expect(feedback.suggestedAction).toBeTruthy();
        }
      }
    });
  });

  describe('A8: navigation and selection remain allowed in Animation', () => {
    it('selection allowed', () => {
      expect(editorModePolicy({ mode: 'animation', actionId: ACTION_IDS.SELECTION }).allowed).toBe(true);
    });

    it('zoom allowed', () => {
      expect(editorModePolicy({ mode: 'animation', actionId: ACTION_IDS.ZOOM }).allowed).toBe(true);
    });

    it('pan allowed', () => {
      expect(editorModePolicy({ mode: 'animation', actionId: ACTION_IDS.PAN }).allowed).toBe(true);
    });

    it('playback allowed', () => {
      expect(editorModePolicy({ mode: 'animation', actionId: ACTION_IDS.PLAYBACK }).allowed).toBe(true);
    });
  });

  describe('bone rename allowed in both modes', () => {
    it('allowed in animation', () => {
      const decision = editorModePolicy({ mode: 'animation', actionId: ACTION_IDS.BONE_RENAME, targetKind: 'bone' });
      expect(decision.allowed).toBe(true);
    });

    it('allowed in staging', () => {
      const decision = editorModePolicy({ mode: 'staging', actionId: ACTION_IDS.BONE_RENAME, targetKind: 'bone' });
      expect(decision.allowed).toBe(true);
    });
  });

  describe('node rename and library organize allowed in both modes (R13)', () => {
    it('rename allowed in animation', () => {
      expect(editorModePolicy({ mode: 'animation', actionId: ACTION_IDS.RENAME }).allowed).toBe(true);
    });

    it('library.organize allowed in animation', () => {
      expect(editorModePolicy({ mode: 'animation', actionId: ACTION_IDS.LIBRARY_ORGANIZE }).allowed).toBe(true);
    });
  });

  describe('defense-in-depth: PixiBoneAssignment.commitDrawnBone blocks in Animation', () => {
    let commitDrawnBone;

    beforeEach(async () => {
      const mod = await import('@/features/canvas/infrastructure/rendering/pixi/PixiBoneAssignment.js');
      commitDrawnBone = mod.commitDrawnBone;
    });

    it('does not push bone in animation mode', () => {
      const interactionCalls = [];
      const projectCalls = [];
      const adapter = {
        editorRef: { current: { editorMode: 'animation' } },
        projectRef: { current: { nodes: [], bones: [] } },
        imageDataByPartId: {},
        _executeCommand: (cmd) => {
          if (cmd.type === 'updateProject') projectCalls.push(cmd);
          if (cmd.type === 'setInteraction') interactionCalls.push(cmd);
        },
        markDirty: vi.fn(),
      };
      commitDrawnBone(adapter, {
        startWorldX: 0, startWorldY: 0,
        endWorldX: 100, endWorldY: 0,
      });
      expect(projectCalls).toHaveLength(0);
      expect(interactionCalls).toHaveLength(1);
      expect(interactionCalls[0].payload.interaction.kind).toBe('canvasNotice');
    });

    it('pushes bone in staging mode', () => {
      const projectCalls = [];
      const adapter = {
        editorRef: { current: { editorMode: 'staging' } },
        projectRef: { current: { nodes: [], bones: [] } },
        imageDataByPartId: {},
        _executeCommand: (cmd) => {
          if (cmd.type === 'updateProject') projectCalls.push(cmd);
        },
        markDirty: vi.fn(),
      };
      commitDrawnBone(adapter, {
        startWorldX: 0, startWorldY: 0,
        endWorldX: 100, endWorldY: 0,
      });
      expect(projectCalls).toHaveLength(1);
    });
  });

  describe('defense-in-depth: PixiIkConstraintGestures blocks IK create in Animation', () => {
    let handleIkPointerDown;

    beforeEach(async () => {
      vi.doMock('@/features/canvas/domain/picking.js', () => ({
        findBoneHit: vi.fn(() => null),
        findConstraintTargetHit: vi.fn(() => null),
      }));
      vi.doMock('@/features/canvas/domain/ikConstraintCreation.js', () => ({
        assignConstraintToBone: vi.fn(),
        createIkConstraint: vi.fn(),
        findConstraintConflict: vi.fn(),
        findNearestAvailableBoneTip: vi.fn(() => ({ boneId: 'b1' })),
      }));
      vi.doMock('@/domain/animationEngine.js', () => ({
        computePoseOverrides: vi.fn(() => new Map()),
      }));
      vi.doMock('@/features/canvas/infrastructure/rendering/pixi/PixiInputState.js', () => ({
        getAdapterEffectiveRigState: vi.fn(() => ({ bones: [] })),
      }));
      const mod = await import('@/features/canvas/infrastructure/rendering/pixi/PixiIkConstraintGestures.js');
      handleIkPointerDown = mod.handleIkPointerDown;
    });

    afterEach(() => {
      vi.doUnmock('@/features/canvas/domain/picking.js');
      vi.doUnmock('@/features/canvas/domain/ikConstraintCreation.js');
      vi.doUnmock('@/domain/animationEngine.js');
      vi.doUnmock('@/features/canvas/infrastructure/rendering/pixi/PixiInputState.js');
      vi.resetModules();
    });

    it('shows canvasNotice and returns true in animation mode', () => {
      const interactionCalls = [];
      const adapter = {
        editorRef: { current: { editorMode: 'animation', activeTool: 'drawIk', interaction: null } },
        projectRef: { current: { bones: [], constraints: [], animations: [] } },
        animationRef: { current: {} },
        _executeCommand: (cmd) => { if (cmd.type === 'setInteraction') interactionCalls.push(cmd); },
        markDirty: vi.fn(),
      };
      const result = handleIkPointerDown(adapter, { x: 0, y: 0 });
      expect(result).toBe(true);
      expect(interactionCalls).toHaveLength(1);
      expect(interactionCalls[0].payload.interaction.kind).toBe('canvasNotice');
    });
  });

  describe('defense-in-depth: useMeshCommands blocks remesh/delete in Animation', () => {
    it('remesh policy blocks in animation mode', () => {
      const decision = editorModePolicy({ mode: 'animation', actionId: ACTION_IDS.REMESH, targetKind: 'node' });
      expect(decision.allowed).toBe(false);
      expect(decision.reasonCode).toBe(REASON_CODES.STAGING_ONLY_STRUCTURE);
    });

    it('remesh policy allows in staging mode', () => {
      const decision = editorModePolicy({ mode: 'staging', actionId: ACTION_IDS.REMESH, targetKind: 'node' });
      expect(decision.allowed).toBe(true);
    });
  });

  describe('layer DnD guards: depth reorder blocked in Animation', () => {
    it('hierarchy.reorder policy blocks in animation', () => {
      const decision = editorModePolicy({ mode: 'animation', actionId: ACTION_IDS.HIERARCHY_REORDER, targetKind: 'node' });
      expect(decision.allowed).toBe(false);
      expect(decision.reasonCode).toBe(REASON_CODES.STAGING_ONLY_STRUCTURE);
    });

    it('node.delete policy blocks in animation (depth delete guard)', () => {
      const decision = editorModePolicy({ mode: 'animation', actionId: ACTION_IDS.BONE_DELETE, targetKind: 'node' });
      expect(decision.allowed).toBe(false);
    });
  });

  describe('layer DnD guards: bone tree reparent/link blocked in Animation', () => {
    it('bone.reparent policy blocks in animation', () => {
      const decision = editorModePolicy({ mode: 'animation', actionId: ACTION_IDS.BONE_REPARENT, targetKind: 'bone' });
      expect(decision.allowed).toBe(false);
      expect(decision.reasonCode).toBe(REASON_CODES.STAGING_ONLY_STRUCTURE);
    });

    it('link.toggle policy blocks in animation', () => {
      const decision = editorModePolicy({ mode: 'animation', actionId: ACTION_IDS.LINK_TOGGLE, targetKind: 'node' });
      expect(decision.allowed).toBe(false);
      expect(decision.reasonCode).toBe(REASON_CODES.STAGING_ONLY_STRUCTURE);
    });

    it('bind.toggle policy blocks in animation', () => {
      const decision = editorModePolicy({ mode: 'animation', actionId: ACTION_IDS.BIND_TOGGLE, targetKind: 'node' });
      expect(decision.allowed).toBe(false);
    });
  });

  describe('inspector defense-in-depth: bone structural ops blocked in Animation', () => {
    it('policy blocks bone.create, bone.delete, bone.reparent in animation', () => {
      expect(editorModePolicy({ mode: 'animation', actionId: ACTION_IDS.BONE_CREATE }).allowed).toBe(false);
      expect(editorModePolicy({ mode: 'animation', actionId: ACTION_IDS.BONE_DELETE }).allowed).toBe(false);
      expect(editorModePolicy({ mode: 'animation', actionId: ACTION_IDS.BONE_REPARENT }).allowed).toBe(false);
    });

    it('policy blocks bind.toggle, slot.create, slot.delete in animation', () => {
      expect(editorModePolicy({ mode: 'animation', actionId: ACTION_IDS.BIND_TOGGLE }).allowed).toBe(false);
      expect(editorModePolicy({ mode: 'animation', actionId: ACTION_IDS.SLOT_CREATE }).allowed).toBe(false);
      expect(editorModePolicy({ mode: 'animation', actionId: ACTION_IDS.SLOT_DELETE }).allowed).toBe(false);
    });
  });
});
