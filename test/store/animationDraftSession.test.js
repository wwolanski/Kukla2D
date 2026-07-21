import { beforeEach, describe, expect, it } from 'vitest';
import { useAnimationStore } from '@/store/animationStore';
import { useProjectStore } from '@/store/projectStore';
import { clearHistory, undoCount, undo, applyPatches } from '@/store/undoHistory';
import { createAnimationAuthoringApi } from '@/features/animation';
import { isTimelineVisibleKeyframe } from '@/domain/keyframeProvenance';

function resetStores() {
  clearHistory();
  useAnimationStore.getState().resetPlayback();
  useProjectStore.getState().resetProject();
}

function setupClip() {
  useProjectStore.getState().createAnimationClip({
    animationId: 'anim-1',
    durationMs: 2000,
    fps: 24,
  });
  useProjectStore.getState().updateProject((p) => {
    p.nodes.push({
      id: 'node-1',
      type: 'part',
      name: 'Head',
      parent: null,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
      opacity: 1,
      visible: true,
    });
    p.bones.push({
      id: 'bone-1',
      name: 'Spine',
      parentId: null,
      setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
    });
  }, { skipHistory: true });
  useAnimationStore.getState().switchAnimation(
    useProjectStore.getState().project.animations[0],
  );
}

describe('animation draft session', () => {
  let api;

  beforeEach(() => {
    resetStores();
    setupClip();
    api = createAnimationAuthoringApi();
  });

  it('resetPlayback clears the complete draft lifecycle', () => {
    const store = useAnimationStore.getState();
    store.setDraftContext({ animationId: 'anim-1', timeMs: 500 });
    store.setDraftPose('node-1', { x: 42 });
    store.setDraftAuthoring('node-1', 'x', {
      gestureId: 'gesture-1',
      role: 'authored',
      source: 'test',
    });
    store.markDraftDirty();

    store.resetPlayback();

    expect(useAnimationStore.getState()).toMatchObject({
      draftContext: null,
      draftDirty: false,
      draftRevision: 0,
      loopCount: 0,
      isPlaying: false,
    });
    expect(useAnimationStore.getState().draftPose.size).toBe(0);
    expect(useAnimationStore.getState().draftAuthoring.size).toBe(0);
  });

  describe('preview', () => {
    it('creates draft context on first preview', () => {
      api.preview({
        animationId: 'anim-1',
        targetId: 'node-1',
        property: 'x',
        value: 42,
        timeMs: 500,
        source: 'inspector',
        phase: 'preview',
      });

      const state = api.getDraftState();
      expect(state.context).toEqual({ animationId: 'anim-1', timeMs: 500 });
      expect(state.dirty).toBe(true);
      expect(state.pose.get('node-1')).toEqual({ x: 42 });
    });

    it('does not change project', () => {
      const before = JSON.stringify(useProjectStore.getState().project);
      api.preview({
        animationId: 'anim-1',
        targetId: 'node-1',
        property: 'x',
        value: 42,
        timeMs: 500,
        source: 'inspector',
        phase: 'preview',
      });
      const after = JSON.stringify(useProjectStore.getState().project);
      expect(before).toBe(after);
    });

    it('does not create undo entry', () => {
      const before = undoCount();
      api.preview({
        animationId: 'anim-1',
        targetId: 'node-1',
        property: 'x',
        value: 42,
        timeMs: 500,
        source: 'inspector',
        phase: 'preview',
      });
      expect(undoCount()).toBe(before);
    });

    it('accumulates multiple preview intents', () => {
      api.preview({
        animationId: 'anim-1',
        targetId: 'node-1',
        property: 'x',
        value: 10,
        timeMs: 500,
        source: 'canvas',
        phase: 'preview',
      });
      api.preview({
        animationId: 'anim-1',
        targetId: 'node-1',
        property: 'y',
        value: 20,
        timeMs: 500,
        source: 'canvas',
        phase: 'preview',
      });

      const state = api.getDraftState();
      expect(state.pose.get('node-1')).toEqual({ x: 10, y: 20 });
    });
  });

  describe('commit', () => {
    it('writes draft to project and creates undo entry', () => {
      api.preview({
        animationId: 'anim-1',
        targetId: 'node-1',
        property: 'x',
        value: 42,
        timeMs: 0,
        source: 'canvas',
        phase: 'preview',
      });

      const before = undoCount();
      const result = api.commit({ source: 'auto-key' });

      expect(result.changed).toBe(true);
      expect(result.committedAddresses).toContain('node-1::x@0');
      expect(undoCount()).toBe(before + 1);

      const anim = useProjectStore.getState().project.animations[0];
      const track = anim.tracks.find(t => t.targetId === 'node-1' && t.property === 'x');
      expect(track).toBeDefined();
    });

    it('clears draft after commit', () => {
      api.preview({
        animationId: 'anim-1',
        targetId: 'node-1',
        property: 'x',
        value: 42,
        timeMs: 0,
        source: 'canvas',
        phase: 'preview',
      });
      api.commit({ source: 'auto-key' });

      const state = api.getDraftState();
      expect(state.dirty).toBe(false);
      expect(state.pose.size).toBe(0);
      expect(state.context).toBeNull();
    });

    it('returns no-op for empty draft', () => {
      const result = api.commit();
      expect(result.changed).toBe(false);
    });

    it('creates single undo for multi-channel commit', () => {
      api.preview({
        animationId: 'anim-1',
        targetId: 'node-1',
        property: 'x',
        value: 10,
        timeMs: 0,
        source: 'canvas',
        phase: 'preview',
      });
      api.preview({
        animationId: 'anim-1',
        targetId: 'node-1',
        property: 'y',
        value: 20,
        timeMs: 0,
        source: 'canvas',
        phase: 'preview',
      });

      const before = undoCount();
      api.commit({ source: 'auto-key' });
      expect(undoCount()).toBe(before + 1);
    });
  });

  describe('keySelected', () => {
    it('commits draft when draft is dirty', () => {
      api.preview({
        animationId: 'anim-1',
        targetId: 'node-1',
        property: 'x',
        value: 42,
        timeMs: 0,
        source: 'canvas',
        phase: 'preview',
      });

      const result = api.keySelected({ targetIds: ['node-1'] });
      expect(result.changed).toBe(true);
    });

    it('snapshots pose when no draft exists', () => {
      const result = api.keySelected({
        targetIds: ['node-1'],
        source: 'manual-key',
      });
      expect(result.changed).toBe(true);
      expect(result.committedAddresses.some(a => a.startsWith('node-1::'))).toBe(true);
    });

    it('returns no-op for empty targetIds', () => {
      const result = api.keySelected({ targetIds: [] });
      expect(result.changed).toBe(false);
    });

    it('returns mode=draft when draft is dirty', () => {
      api.preview({
        animationId: 'anim-1',
        targetId: 'node-1',
        property: 'x',
        value: 42,
        timeMs: 0,
        source: 'canvas',
        phase: 'preview',
      });
      const result = api.keySelected({ targetIds: ['node-1'] });
      expect(result.mode).toBe('draft');
    });

    it('returns mode=snapshot-core when no draft', () => {
      const result = api.keySelected({
        targetIds: ['node-1'],
        source: 'manual-key',
      });
      expect(result.mode).toBe('snapshot-core');
    });

    it('returns mode=null when no selection', () => {
      const result = api.keySelected({ targetIds: [] });
      expect(result.mode).toBeNull();
    });
  });

  describe('discard', () => {
    it('clears draft without writing to project', () => {
      api.preview({
        animationId: 'anim-1',
        targetId: 'node-1',
        property: 'x',
        value: 42,
        timeMs: 500,
        source: 'canvas',
        phase: 'preview',
      });

      const before = undoCount();
      api.discard();
      expect(undoCount()).toBe(before);

      const state = api.getDraftState();
      expect(state.dirty).toBe(false);
      expect(state.pose.size).toBe(0);
    });
  });

  describe('checkNavigation', () => {
    it('allows navigation when draft is clean', () => {
      expect(api.checkNavigation()).toEqual({ allowed: true });
    });

    it('blocks navigation when draft is dirty', () => {
      api.preview({
        animationId: 'anim-1',
        targetId: 'node-1',
        property: 'x',
        value: 42,
        timeMs: 500,
        source: 'canvas',
        phase: 'preview',
      });

      expect(api.checkNavigation()).toEqual({ allowed: false, reason: 'pending-draft' });
    });

    it('allows navigation after commit', () => {
      api.preview({
        animationId: 'anim-1',
        targetId: 'node-1',
        property: 'x',
        value: 42,
        timeMs: 0,
        source: 'canvas',
        phase: 'preview',
      });
      api.commit();
      expect(api.checkNavigation()).toEqual({ allowed: true });
    });

    it('allows navigation after discard', () => {
      api.preview({
        animationId: 'anim-1',
        targetId: 'node-1',
        property: 'x',
        value: 42,
        timeMs: 500,
        source: 'canvas',
        phase: 'preview',
      });
      api.discard();
      expect(api.checkNavigation()).toEqual({ allowed: true });
    });
  });

  describe('undo atomicity', () => {
    it('undo reverses entire commit', () => {
      api.preview({
        animationId: 'anim-1',
        targetId: 'node-1',
        property: 'x',
        value: 99,
        timeMs: 0,
        source: 'canvas',
        phase: 'preview',
      });
      api.commit();

      undo((patches) => {
        const restored = applyPatches(useProjectStore.getState(), patches);
        useProjectStore.getState().restoreProject(restored);
      });

      const anim = useProjectStore.getState().project.animations[0];
      const track = anim.tracks.find(t => t.targetId === 'node-1' && t.property === 'x');
      expect(track).toBeUndefined();
    });
  });

  // ── Stage 02: Provenance metadata ───────────────────────────────────────────

  describe('draft authoring metadata', () => {
    it('stores provenance alongside draft values on preview', () => {
      api.preview({
        animationId: 'anim-1',
        targetId: 'node-1',
        property: 'x',
        value: 42,
        timeMs: 500,
        source: 'gesture',
        phase: 'preview',
      });

      const state = useAnimationStore.getState();
      expect(state.draftPose.get('node-1')).toEqual({ x: 42 });
      const meta = state.draftAuthoring.get('node-1')?.x;
      expect(meta).toBeDefined();
      expect(meta.role).toBe('authored');
      expect(meta.source).toBe('gesture');
      expect(meta.gestureId).toBeTruthy();
    });

    it('clearDraftPoseForNode also clears draftAuthoring', () => {
      api.preview({
        animationId: 'anim-1',
        targetId: 'node-1',
        property: 'x',
        value: 42,
        timeMs: 500,
        source: 'gesture',
        phase: 'preview',
      });

      expect(useAnimationStore.getState().draftAuthoring.size).toBe(1);
      useAnimationStore.getState().clearDraftPoseForNode('node-1');
      expect(useAnimationStore.getState().draftAuthoring.size).toBe(0);
    });

    it('clearDraftPose also clears draftAuthoring', () => {
      api.preview({
        animationId: 'anim-1',
        targetId: 'node-1',
        property: 'x',
        value: 42,
        timeMs: 500,
        source: 'gesture',
        phase: 'preview',
      });

      useAnimationStore.getState().clearDraftPose();
      expect(useAnimationStore.getState().draftAuthoring.size).toBe(0);
    });

    it('clearDraftChannelsForTargets clears both maps', () => {
      api.preview({
        animationId: 'anim-1',
        targetId: 'node-1',
        property: 'x',
        value: 42,
        timeMs: 500,
        source: 'gesture',
        phase: 'preview',
      });

      useAnimationStore.getState().clearDraftChannelsForTargets(['node-1']);
      expect(useAnimationStore.getState().draftPose.size).toBe(0);
      expect(useAnimationStore.getState().draftAuthoring.size).toBe(0);
    });

    it('snapshotDraftAuthoring preserves metadata', () => {
      api.preview({
        animationId: 'anim-1',
        targetId: 'node-1',
        property: 'x',
        value: 42,
        timeMs: 500,
        source: 'gesture',
        phase: 'preview',
      });

      const snapshot = useAnimationStore.getState().snapshotDraftAuthoring();
      expect(snapshot['node-1']).toBeDefined();
      expect(snapshot['node-1'].x.role).toBe('authored');

      useAnimationStore.getState().clearDraftAuthoring();
      expect(useAnimationStore.getState().draftAuthoring.size).toBe(0);

      useAnimationStore.getState().restoreDraftAuthoring(snapshot);
      expect(useAnimationStore.getState().draftAuthoring.size).toBe(1);
    });
  });

  describe('commit with provenance', () => {
    it('committed keyframes carry authoring metadata', () => {
      api.preview({
        animationId: 'anim-1',
        targetId: 'node-1',
        property: 'x',
        value: 42,
        timeMs: 500,
        source: 'canvas',
        phase: 'preview',
      });

      api.commit({ source: 'auto-key' });

      const anim = useProjectStore.getState().project.animations[0];
      const kf = anim.tracks.find(t => t.targetId === 'node-1' && t.property === 'x')
        .keyframes.find(k => k.time === 500);
      expect(kf.authoring).toBeDefined();
      expect(kf.authoring.role).toBe('authored');
      expect(kf.authoring.source).toBe('canvas');
    });

    it('support baseline keyframe gets support role', () => {
      api.preview({
        animationId: 'anim-1',
        targetId: 'node-1',
        property: 'x',
        value: 42,
        timeMs: 500,
        source: 'canvas',
        phase: 'preview',
      });

      api.commit({ source: 'auto-key' });

      const anim = useProjectStore.getState().project.animations[0];
      const supportKf = anim.tracks.find(t => t.targetId === 'node-1' && t.property === 'x')
        .keyframes.find(k => k.time === 0);
      expect(supportKf).toBeDefined();
      expect(supportKf.authoring.role).toBe('support');
      expect(supportKf.authoring.gestureId).toBeTruthy();
    });

    it('support keyframe is not timeline-visible', () => {
      api.preview({
        animationId: 'anim-1',
        targetId: 'node-1',
        property: 'x',
        value: 42,
        timeMs: 500,
        source: 'canvas',
        phase: 'preview',
      });

      api.commit({ source: 'auto-key' });

      const anim = useProjectStore.getState().project.animations[0];
      const supportKf = anim.tracks.find(t => t.targetId === 'node-1' && t.property === 'x')
        .keyframes.find(k => k.time === 0);
      expect(isTimelineVisibleKeyframe(supportKf)).toBe(false);

      const authoredKf = anim.tracks.find(t => t.targetId === 'node-1' && t.property === 'x')
        .keyframes.find(k => k.time === 500);
      expect(isTimelineVisibleKeyframe(authoredKf)).toBe(true);
    });

    it('returns materializedCount in result', () => {
      api.preview({
        animationId: 'anim-1',
        targetId: 'node-1',
        property: 'x',
        value: 42,
        timeMs: 500,
        source: 'canvas',
        phase: 'preview',
      });

      const result = api.commit({ source: 'auto-key' });
      expect(result.materializedCount).toBe(1);
    });
  });

  describe('beginGesture / cancelGesture lifecycle', () => {
    it('beginGesture returns a stable gestureId', () => {
      const id1 = api.beginGesture({ gestureId: 'test-gesture' });
      expect(id1).toBe('test-gesture');
    });

    it('cancelGesture clears gesture and draft', () => {
      api.beginGesture({ gestureId: 'g-1' });
      api.preview({
        animationId: 'anim-1',
        targetId: 'node-1',
        property: 'x',
        value: 42,
        timeMs: 0,
        source: 'gesture',
        phase: 'preview',
      });

      expect(useAnimationStore.getState().draftDirty).toBe(true);
      api.cancelGesture();
      expect(useAnimationStore.getState().draftDirty).toBe(false);
      expect(useAnimationStore.getState().draftPose.size).toBe(0);
      expect(useAnimationStore.getState().draftAuthoring.size).toBe(0);
    });

    it('two previews without commit share gestureId via beginGesture', () => {
      api.beginGesture({ gestureId: 'g-1' });
      api.preview({
        animationId: 'anim-1',
        targetId: 'node-1',
        property: 'x',
        value: 10,
        timeMs: 0,
        source: 'gesture',
        phase: 'preview',
      });
      api.preview({
        animationId: 'anim-1',
        targetId: 'node-1',
        property: 'y',
        value: 20,
        timeMs: 0,
        source: 'gesture',
        phase: 'preview',
      });

      const meta = useAnimationStore.getState().draftAuthoring.get('node-1');
      expect(meta.x.gestureId).toBe('g-1');
      expect(meta.y.gestureId).toBe('g-1');
    });
  });

  describe('inspector caller without beginGesture', () => {
    it('preview without explicit gestureId generates one', () => {
      api.preview({
        animationId: 'anim-1',
        targetId: 'node-1',
        property: 'x',
        value: 42,
        timeMs: 500,
        source: 'inspector',
        phase: 'preview',
      });

      const meta = useAnimationStore.getState().draftAuthoring.get('node-1')?.x;
      expect(meta).toBeDefined();
      expect(meta.role).toBe('authored');
      expect(meta.gestureId).toBeTruthy();
    });
  });

  describe('discard clears draftAuthoring', () => {
    it('discard removes both draftPose and draftAuthoring', () => {
      api.preview({
        animationId: 'anim-1',
        targetId: 'node-1',
        property: 'x',
        value: 42,
        timeMs: 500,
        source: 'canvas',
        phase: 'preview',
      });

      api.discard();

      const s = useAnimationStore.getState();
      expect(s.draftPose.size).toBe(0);
      expect(s.draftAuthoring.size).toBe(0);
      expect(s.draftDirty).toBe(false);
    });
  });

  describe('Stage 03: canvas gesture unification', () => {
    it('commit with gestureId classifies authored vs derived roles', () => {
      api.beginGesture({ gestureId: 'pose-gesture-1' });
      api.preview({
        animationId: 'anim-1', targetId: 'bone-1', property: 'rotation',
        value: 45, timeMs: 500, source: 'pose.rotate', phase: 'preview',
        gestureId: 'pose-gesture-1', role: 'authored',
      });
      api.preview({
        animationId: 'anim-1', targetId: 'node-1', property: 'x',
        value: 100, timeMs: 500, source: 'pose.rotate', phase: 'preview',
        gestureId: 'pose-gesture-1', role: 'derived',
      });
      const before = useAnimationStore.getState();
      expect(before.draftAuthoring.get('bone-1')?.rotation.role).toBe('authored');
      expect(before.draftAuthoring.get('node-1')?.x.role).toBe('derived');

      const result = api.commit({ source: 'auto-key' });
      expect(result.changed).toBe(true);

      const clip = useProjectStore.getState().project.animations[0];
      const rotationTrack = clip.tracks.find(t => t.targetId === 'bone-1' && t.property === 'rotation');
      expect(rotationTrack).toBeDefined();
      const authoredKf = rotationTrack.keyframes.find(k => k.time === 500);
      expect(authoredKf.authoring?.role).toBe('authored');
      const xTrack = clip.tracks.find(t => t.targetId === 'node-1' && t.property === 'x');
      expect(xTrack).toBeDefined();
      const derivedKf = xTrack.keyframes.find(k => k.time === 500);
      expect(derivedKf.authoring?.role).toBe('derived');
    });

    it('Pose root authored + derived branch are rendered identically', () => {
      api.beginGesture({ gestureId: 'pose-equiv-1' });
      const authoredTime = 500;
      const branchTargets = [
        { id: 'bone-1', property: 'rotation', value: 45, role: 'authored' },
        { id: 'bone-1', property: 'x', value: 10, role: 'authored' },
        { id: 'bone-1', property: 'y', value: 5, role: 'authored' },
        { id: 'node-1', property: 'x', value: 80, role: 'derived' },
        { id: 'node-1', property: 'y', value: 30, role: 'derived' },
      ];
      for (const t of branchTargets) {
        api.preview({
          animationId: 'anim-1', targetId: t.id, property: t.property,
          value: t.value, timeMs: authoredTime, source: 'pose.rotate',
          phase: 'preview', gestureId: 'pose-equiv-1', role: t.role,
        });
      }
      api.commit({ source: 'auto-key' });

      const clip = useProjectStore.getState().project.animations[0];
      const authoredKeys = clip.tracks
        .flatMap(t => t.keyframes)
        .filter(k => k.authoring?.role === 'authored');
      const derivedKeys = clip.tracks
        .flatMap(t => t.keyframes)
        .filter(k => k.authoring?.role === 'derived');
      expect(authoredKeys.length).toBeGreaterThan(0);
      expect(derivedKeys.length).toBeGreaterThan(0);

      const boneRotationKf = clip.tracks
        .filter(t => t.targetId === 'bone-1' && t.property === 'rotation')
        .flatMap(t => t.keyframes)
        .find(k => k.time === 500);
      expect(boneRotationKf.value).toBe(45);
    });

    it('Transform multiselect keeps all targets authored', () => {
      useProjectStore.getState().updateProject((p) => {
        p.bones.push({
          id: 'bone-2', name: 'Arm2', parentId: null,
          setup: { x: 100, y: 0, rotation: 0, scaleX: 1, scaleY: 1, length: 80 },
        });
      }, { skipHistory: true });

      api.beginGesture({ gestureId: 'multi-select-1' });
      const targets = [
        { id: 'bone-1', property: 'x', value: 20, role: 'authored' },
        { id: 'bone-2', property: 'x', value: 40, role: 'authored' },
      ];
      for (const t of targets) {
        api.preview({
          animationId: 'anim-1', targetId: t.id, property: t.property,
          value: t.value, timeMs: 500, source: 'transform', phase: 'preview',
          gestureId: 'multi-select-1', role: t.role,
        });
      }
      const result = api.commit({ source: 'auto-key' });
      expect(result.changed).toBe(true);

      const clip = useProjectStore.getState().project.animations[0];
      const bone1Track = clip.tracks.find(t => t.targetId === 'bone-1' && t.property === 'x');
      const bone2Track = clip.tracks.find(t => t.targetId === 'bone-2' && t.property === 'x');
      expect(bone1Track).toBeDefined();
      expect(bone2Track).toBeDefined();
      expect(bone1Track.keyframes.find(k => k.time === 500).value).toBe(20);
      expect(bone2Track.keyframes.find(k => k.time === 500).value).toBe(40);
    });

    it('cancel gesture removes draft without commit', () => {
      api.beginGesture({ gestureId: 'cancel-test' });
      api.preview({
        animationId: 'anim-1', targetId: 'node-1', property: 'x',
        value: 99, timeMs: 500, source: 'canvas', phase: 'preview',
        gestureId: 'cancel-test', role: 'authored',
      });
      expect(useAnimationStore.getState().draftDirty).toBe(true);
      api.cancelGesture();
      const s = useAnimationStore.getState();
      expect(s.draftPose.size).toBe(0);
      expect(s.draftAuthoring.size).toBe(0);
      expect(s.draftDirty).toBe(false);
      const clip = useProjectStore.getState().project.animations[0];
      expect(clip.tracks.length).toBe(0);
    });

    it('no-op without changes returns changed:false', () => {
      const result = api.commit({ source: 'auto-key' });
      expect(result.changed).toBe(false);
      expect(result.committedAddresses).toEqual([]);
    });

    it('beginGesture generates and returns a stable gestureId', () => {
      const id1 = api.beginGesture();
      expect(id1).toBeTruthy();
      const id2 = api.beginGesture({ gestureId: 'explicit-id' });
      expect(id2).toBe('explicit-id');
      api.cancelGesture();
    });
  });
});
