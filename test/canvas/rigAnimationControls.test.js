import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getBoneSegment } from '@/features/canvas/domain/picking.js';
import { buildBoneTransformFrame } from '@/features/canvas/domain/skeletonFrame.js';
import { editorModePolicy, ACTION_IDS, REASON_CODES } from '@/domain/editorModePolicy.js';
import { getFeedback } from '@/domain/editorModeFeedback.js';
import {
  isAuthorableProperty,
  isPropertyAllowedForTargetKind,
} from '@/domain/animationProperties.js';

describe('rig animation controls — stage 03', () => {

  describe('G3: length is blocked in Animation, allowed in Staging', () => {
    it('policy blocks bone.length in animation mode', () => {
      const decision = editorModePolicy({ mode: 'animation', actionId: ACTION_IDS.BONE_LENGTH, targetKind: 'bone' });
      expect(decision.allowed).toBe(false);
      expect(decision.reasonCode).toBe(REASON_CODES.STAGING_ONLY_BONE_LENGTH);
    });

    it('policy allows bone.length in staging mode', () => {
      const decision = editorModePolicy({ mode: 'staging', actionId: ACTION_IDS.BONE_LENGTH, targetKind: 'bone' });
      expect(decision.allowed).toBe(true);
    });

    it('policy blocks bone.pivot in animation mode', () => {
      const decision = editorModePolicy({ mode: 'animation', actionId: ACTION_IDS.BONE_PIVOT, targetKind: 'bone' });
      expect(decision.allowed).toBe(false);
      expect(decision.reasonCode).toBe(REASON_CODES.STAGING_ONLY_PIVOT);
    });

    it('policy allows bone.pivot in staging mode', () => {
      const decision = editorModePolicy({ mode: 'staging', actionId: ACTION_IDS.BONE_PIVOT, targetKind: 'bone' });
      expect(decision.allowed).toBe(true);
    });

    it('length feedback message explains scale alternative', () => {
      const feedback = getFeedback(REASON_CODES.STAGING_ONLY_BONE_LENGTH);
      expect(feedback.message).toContain('Staging rig');
      expect(feedback.suggestedAction).toContain('Scale X');
    });

    it('pivot feedback message explains staging', () => {
      const feedback = getFeedback(REASON_CODES.STAGING_ONLY_PIVOT);
      expect(feedback.message).toContain('setup-only');
      expect(feedback.suggestedAction).toContain('Staging');
    });
  });

  describe('A7: pivot is disabled in Animation and has no preview', () => {
    it('pivot fields are not authorable for bone in animation', () => {
      expect(isAuthorableProperty('pivotX')).toBe(false);
      expect(isAuthorableProperty('pivotY')).toBe(false);
    });

    it('pivot is not authorable for node in animation either', () => {
      expect(isPropertyAllowedForTargetKind('pivotX', 'node')).toBe(false);
    });
  });

  describe('A6: bone scale is authorable in Animation', () => {
    it('scaleX is authorable for bone', () => {
      expect(isAuthorableProperty('scaleX')).toBe(true);
      expect(isPropertyAllowedForTargetKind('scaleX', 'bone')).toBe(true);
    });

    it('scaleY is authorable for bone', () => {
      expect(isAuthorableProperty('scaleY')).toBe(true);
      expect(isPropertyAllowedForTargetKind('scaleY', 'bone')).toBe(true);
    });

    it('bone scale policy allows in animation', () => {
      const decision = editorModePolicy({ mode: 'animation', actionId: ACTION_IDS.BONE_SCALE, targetKind: 'bone' });
      expect(decision.allowed).toBe(true);
      expect(decision.channel).toBe('animation-channel');
    });

    it('bone move/rotate are also authorable', () => {
      expect(editorModePolicy({ mode: 'animation', actionId: ACTION_IDS.BONE_MOVE, targetKind: 'bone' }).allowed).toBe(true);
      expect(editorModePolicy({ mode: 'animation', actionId: ACTION_IDS.BONE_ROTATE, targetKind: 'bone' }).allowed).toBe(true);
    });
  });

  describe('effective bone segment includes scaleX', () => {
    it('getBoneSegment uses length * abs(scaleX) for effective length', () => {
      const bone = { setup: { x: 0, y: 0, rotation: 0, length: 100, scaleX: 2, scaleY: 1 } };
      const seg = getBoneSegment(bone, new Map());
      expect(seg.x1).toBe(0);
      expect(seg.y1).toBe(0);
      expect(seg.x2).toBe(200);
      expect(seg.y2).toBe(0);
    });

    it('getBoneSegment uses setup length when scaleX is 1', () => {
      const bone = { setup: { x: 0, y: 0, rotation: 0, length: 80, scaleX: 1, scaleY: 1 } };
      const seg = getBoneSegment(bone, new Map());
      expect(seg.x2).toBe(80);
    });

    it('getBoneSegment handles negative scaleX', () => {
      const bone = { setup: { x: 0, y: 0, rotation: 0, length: 100, scaleX: -1, scaleY: 1 } };
      const seg = getBoneSegment(bone, new Map());
      expect(seg.x2).toBe(100);
    });

    it('getBoneSegment defaults to length 80 when no setup', () => {
      const bone = { setup: {} };
      const seg = getBoneSegment(bone, new Map());
      expect(seg.x2).toBe(80);
    });
  });

  describe('buildBoneTransformFrame — length handle visibility', () => {
    it('lengthAllowed is true in staging', () => {
      const bones = [{ id: 'b1', setup: { x: 0, y: 0, rotation: 0, length: 80, scaleX: 1, scaleY: 1 } }];
      const frame = buildBoneTransformFrame({
        effectiveBones: bones,
        editorState: { activeBoneId: 'b1', activeTool: 'transform', selectionTarget: 'all' },
        boneMap: new Map(bones.map(b => [b.id, b])),
      });
      expect(frame).not.toBeNull();
      expect(frame.lengthAllowed).toBe(true);
    });

    it('lengthAllowed is false in animation', () => {
      const bones = [{ id: 'b1', setup: { x: 0, y: 0, rotation: 0, length: 80, scaleX: 1, scaleY: 1 } }];
      const frame = buildBoneTransformFrame({
        effectiveBones: bones,
        editorState: { activeBoneId: 'b1', activeTool: 'transform', selectionTarget: 'all', editorMode: 'animation' },
        boneMap: new Map(bones.map(b => [b.id, b])),
      });
      expect(frame).not.toBeNull();
      expect(frame.lengthAllowed).toBe(false);
    });

    it('end point reflects effective length (length * scaleX)', () => {
      const bones = [{ id: 'b1', setup: { x: 0, y: 0, rotation: 0, length: 100, scaleX: 2, scaleY: 1 } }];
      const frame = buildBoneTransformFrame({
        effectiveBones: bones,
        editorState: { activeBoneId: 'b1', activeTool: 'transform', selectionTarget: 'all' },
        boneMap: new Map(bones.map(b => [b.id, b])),
      });
      expect(frame.end.x).toBe(200);
    });
  });

  describe('A11: rotate ring clamp with bone length', () => {
    const makeFrame = (len, overrides = {}) => {
      const bones = [{ id: 'b1', setup: { x: 0, y: 0, rotation: 0, length: len, scaleX: 1, scaleY: 1 } }];
      return buildBoneTransformFrame({
        effectiveBones: bones,
        editorState: { activeBoneId: 'b1', activeTool: 'transform', selectionTarget: 'all', ...overrides },
        boneMap: new Map(bones.map(b => [b.id, b])),
      });
    };

    it('long bone (400) clamps rotateRingRadius to MAX(38)', () => {
      const frame = makeFrame(400);
      expect(frame.rotateRingRadius).toBeLessThanOrEqual(38);
      expect(frame.rotateRingRadius).toBe(38);
    });

    it('tiny bone (50) clamps rotateRingRadius to MIN(10)', () => {
      const frame = makeFrame(50);
      expect(frame.rotateRingRadius).toBeGreaterThanOrEqual(10);
      expect(frame.rotateRingRadius).toBe(10);
    });

    it('medium bone (200) produces interpolated ring radius', () => {
      const frame = makeFrame(200);
      expect(frame.rotateRingRadius).toBeGreaterThan(10);
      expect(frame.rotateRingRadius).toBeLessThan(38);
      expect(frame.rotateRingRadius).toBe(32);
    });

    it('rotateHitRadius >= rotateRingRadius at all lengths', () => {
      for (const len of [10, 50, 100, 200, 400, 800]) {
        const frame = makeFrame(len);
        expect(frame.rotateHitRadius).toBeGreaterThanOrEqual(frame.rotateRingRadius);
      }
    });

    it('lengthHandleRadius is constant regardless of bone length', () => {
      const short = makeFrame(10);
      const med = makeFrame(200);
      const long = makeFrame(800);
      expect(short.lengthHandleRadius).toBe(7);
      expect(med.lengthHandleRadius).toBe(7);
      expect(long.lengthHandleRadius).toBe(7);
    });
  });

  describe('canvas bone length defense-in-depth', () => {
    let PixiInteractionSystem;
    const graphicsInstances = [];

    function createMockGraphics() {
      const g = {
        position: { set: vi.fn() },
        fill: vi.fn(() => g),
        circle: vi.fn(() => g),
        poly: vi.fn(() => g),
        on: vi.fn(() => g),
        off: vi.fn(() => g),
        destroy: vi.fn(),
        parent: null,
        eventMode: 'passive',
        cursor: null,
      };
      graphicsInstances.push(g);
      return g;
    }

    beforeEach(async () => {
      graphicsInstances.length = 0;
      vi.doMock('pixi.js', () => ({
        Graphics: vi.fn(function Graphics() { return createMockGraphics(); }),
      }));
      const mod = await import('@/features/canvas/infrastructure/rendering/pixi/PixiInteractionSystem.js');
      PixiInteractionSystem = mod.PixiInteractionSystem;
    });

    afterEach(() => {
      vi.doUnmock('pixi.js');
      vi.resetModules();
    });

    it('startBoneLength does not create drag state in Animation mode', () => {
      const project = {
        nodes: [{ id: 'n1', type: 'group', transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 } }],
        bones: [{ id: 'b1', setup: { x: 0, y: 0, rotation: 0, length: 100, scaleX: 1, scaleY: 1 } }],
        constraints: [],
        animations: [{ id: 'anim1', tracks: [] }],
      };
      const editor = {
        selection: ['b1'],
        activeBoneId: 'b1',
        editorMode: 'animation',
        activeTool: 'transform',
        selectionTarget: 'all',
        view: { zoom: 1, panX: 0, panY: 0 },
      };
      const interactionCalls = [];
      const adapter = new PixiInteractionSystem({
        viewportBridge: {
          app: { canvas: { getBoundingClientRect: () => ({ left: 0, top: 0 }) } },
          viewport: { plugins: { pause: vi.fn(), resume: vi.fn() } },
          toWorld: (x, y) => ({ x, y }),
        },
        overlayLayer: {
          addChild: vi.fn((child) => { child.parent = adapter?.overlayLayer; }),
          removeChild: vi.fn(),
        },
        projectRef: { current: project },
        editorRef: { current: editor },
        animationRef: { current: { activeAnimationId: 'anim1', draftPose: new Map() } },
        updateProject: vi.fn(),
        setSelection: vi.fn(),
        markDirty: vi.fn(),
        workflowActor: { send: vi.fn() },
        executeCommand: (cmd) => { interactionCalls.push(cmd); },
      });

      adapter._startBoneLength({ clientX: 100, clientY: 100 });
      expect(adapter._dragState).toBeFalsy();
      const notice = interactionCalls.find(c => c.type === 'setInteraction');
      expect(notice).toBeDefined();
      expect(notice.payload.interaction.kind).toBe('canvasNotice');
    });
  });
});
