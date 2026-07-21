import { describe, it, expect } from 'vitest';
import {
  buildKeyframeEdits,
  buildCommitBatch,
  buildManualKeyBatch,
  describeKeyScope,
} from '../src/domain/animationAuthoring.js';
import {
  createDraftContext,
  isDraftContextValid,
  snapshotDraftChannels,
  restoreDraftFromSnapshot,
  applyPreviewIntent,
  clearDraftChannels,
  resetDraft,
} from '../src/domain/animationDraftState.js';
import { upsertAnimationKeyframes } from '../src/domain/animationKeyframeCommands.js';
import { moveKeyframesPreflight } from '../src/domain/moveKeyframesPreflight.js';
import { isTimelineVisibleKeyframe } from '../src/domain/keyframeProvenance.js';

function makeDraft(animationId = 'anim-1', timeMs = 500) {
  return createDraftContext(animationId, timeMs);
}

function makeProject(overrides = {}) {
  return {
    animations: [{
      id: 'anim-1',
      name: 'Test',
      duration: 2000,
      fps: 24,
      tracks: [],
      markers: [],
      audioTracks: [],
    }],
    nodes: [{
      id: 'node-1',
      type: 'part',
      name: 'Head',
      parent: null,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
      opacity: 1,
      visible: true,
      mesh: {
        geometry: {
          vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
          uvs: [0, 0, 1, 0, 0, 1, 1, 1],
          indices: [0, 1, 2, 1, 3, 2],
        },
      },
      blendShapes: [],
      blendShapeValues: {},
    }],
    bones: [{
      id: 'bone-1',
      name: 'Spine',
      parentId: null,
      setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
    }],
    constraints: [{
      id: 'ik-1',
      name: 'IK Left',
      targetX: 0,
      targetY: 0,
      mix: 1,
      fkIk: 0,
      bendPositive: true,
      order: 0,
    }],
    ...overrides,
  };
}

describe('animationAuthoring', () => {
  describe('createDraftContext', () => {
    it('creates a K3 draft state with null context', () => {
      const draft = createDraftContext('anim-1', 500);
      expect(draft.context).toEqual({ animationId: 'anim-1', timeMs: 500 });
      expect(draft.values).toBeInstanceOf(Map);
      expect(draft.values.size).toBe(0);
      expect(draft.dirty).toBe(false);
      expect(draft.revision).toBe(0);
    });
  });

  describe('isDraftContextValid', () => {
    it('returns true for matching context', () => {
      const draft = makeDraft('anim-1', 500);
      expect(isDraftContextValid(draft, 'anim-1', 500)).toBe(true);
    });

    it('returns false for wrong animationId', () => {
      const draft = makeDraft('anim-1', 500);
      expect(isDraftContextValid(draft, 'anim-2', 500)).toBe(false);
    });

    it('returns false for wrong timeMs', () => {
      const draft = makeDraft('anim-1', 500);
      expect(isDraftContextValid(draft, 'anim-1', 600)).toBe(false);
    });

    it('returns false for null context', () => {
      const draft = makeDraft();
      draft.context = null;
      expect(isDraftContextValid(draft, 'anim-1', 500)).toBe(false);
    });
  });

  describe('snapshotDraftChannels / restoreDraftFromSnapshot', () => {
    it('round-trips snapshot and restore', () => {
      const draft = makeDraft();
      draft.values.set('node-1', { x: 10, opacity: 0.5 });
      draft.values.set('bone-1', { rotation: 45 });
      draft.dirty = true;
      draft.revision = 3;

      const snapshot = snapshotDraftChannels(draft);
      expect(snapshot).toEqual({
        'node-1': { x: 10, opacity: 0.5 },
        'bone-1': { rotation: 45 },
      });

      const draft2 = makeDraft();
      restoreDraftFromSnapshot(draft2, snapshot);
      expect(draft2.values.size).toBe(2);
      expect(draft2.values.get('node-1')).toEqual({ x: 10, opacity: 0.5 });
      expect(draft2.values.get('bone-1')).toEqual({ rotation: 45 });
      expect(draft2.dirty).toBe(true);
      expect(draft2.revision).toBe(1);
    });
  });

  describe('applyPreviewIntent', () => {
    it('merges a valid preview intent into draft', () => {
      const draft = makeDraft();
      const result = applyPreviewIntent(draft, {
        animationId: 'anim-1',
        targetId: 'node-1',
        property: 'x',
        value: 42,
        timeMs: 500,
        source: 'inspector',
        phase: 'preview',
      });
      expect(result.valid).toBe(true);
      expect(draft.values.get('node-1')).toEqual({ x: 42 });
      expect(draft.dirty).toBe(true);
      expect(draft.revision).toBe(1);
    });

    it('rejects non-preview phase', () => {
      const draft = makeDraft();
      const result = applyPreviewIntent(draft, {
        animationId: 'anim-1',
        targetId: 'node-1',
        property: 'x',
        value: 42,
        timeMs: 500,
        source: 'inspector',
        phase: 'commit',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('preview');
    });

    it('rejects non-authorable property', () => {
      const draft = makeDraft();
      const result = applyPreviewIntent(draft, {
        animationId: 'anim-1',
        targetId: 'node-1',
        property: 'event',
        value: 'click',
        timeMs: 500,
        source: 'inspector',
        phase: 'preview',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not authorable');
    });

    it('rejects invalid value for property', () => {
      const draft = makeDraft();
      const result = applyPreviewIntent(draft, {
        animationId: 'anim-1',
        targetId: 'node-1',
        property: 'opacity',
        value: 2.0,
        timeMs: 500,
        source: 'inspector',
        phase: 'preview',
      });
      expect(result.valid).toBe(false);
    });

    it('accumulates multiple intents on same target', () => {
      const draft = makeDraft();
      applyPreviewIntent(draft, {
        animationId: 'anim-1',
        targetId: 'node-1',
        property: 'x',
        value: 10,
        timeMs: 500,
        source: 'canvas',
        phase: 'preview',
      });
      applyPreviewIntent(draft, {
        animationId: 'anim-1',
        targetId: 'node-1',
        property: 'y',
        value: 20,
        timeMs: 500,
        source: 'canvas',
        phase: 'preview',
      });
      expect(draft.values.get('node-1')).toEqual({ x: 10, y: 20 });
    });
  });

  describe('clearDraftChannels', () => {
    it('removes specified target channels', () => {
      const draft = makeDraft();
      draft.values.set('node-1', { x: 10 });
      draft.values.set('bone-1', { rotation: 45 });
      draft.dirty = true;

      clearDraftChannels(draft, ['node-1']);
      expect(draft.values.has('node-1')).toBe(false);
      expect(draft.values.has('bone-1')).toBe(true);
      expect(draft.dirty).toBe(true);
    });

    it('sets dirty to false when all channels cleared', () => {
      const draft = makeDraft();
      draft.values.set('node-1', { x: 10 });
      draft.dirty = true;

      clearDraftChannels(draft, ['node-1']);
      expect(draft.dirty).toBe(false);
    });
  });

  describe('resetDraft', () => {
    it('clears all draft state', () => {
      const draft = makeDraft();
      draft.values.set('node-1', { x: 10 });
      draft.dirty = true;
      draft.revision = 5;

      resetDraft(draft);
      expect(draft.context).toBeNull();
      expect(draft.values.size).toBe(0);
      expect(draft.dirty).toBe(false);
      expect(draft.revision).toBe(0);
    });
  });

  describe('buildKeyframeEdits', () => {
    it('creates edit at current time', () => {
      const result = buildKeyframeEdits({
        animationId: 'anim-1',
        timeMs: 500,
        loopStartMs: 0,
        endMs: 2000,
        targetId: 'node-1',
        property: 'x',
        currentValue: 42,
        node: { x: 0 },
      });
      expect(result.edits).toHaveLength(1);
      expect(result.edits[0]).toEqual({
        animationId: 'anim-1',
        targetId: 'node-1',
        property: 'x',
        timeMs: 500,
        value: 42,
        easing: 'linear',
      });
    });

    it('creates baseline at loopStart when timeMs > loopStartMs', () => {
      const result = buildKeyframeEdits({
        animationId: 'anim-1',
        timeMs: 500,
        loopStartMs: 0,
        endMs: 2000,
        targetId: 'node-1',
        property: 'x',
        currentValue: 42,
        node: { transform: { x: 0 } },
      });
      expect(result.baseline).not.toBeNull();
      expect(result.baseline.timeMs).toBe(0);
      expect(result.baseline.value).toBe(0);
    });

    it('no baseline when timeMs equals loopStartMs', () => {
      const result = buildKeyframeEdits({
        animationId: 'anim-1',
        timeMs: 0,
        loopStartMs: 0,
        endMs: 2000,
        targetId: 'node-1',
        property: 'x',
        currentValue: 42,
        node: { transform: { x: 0 } },
      });
      expect(result.baseline).toBeNull();
    });
  });

  describe('buildCommitBatch', () => {
    it('builds edits from draft values', () => {
      const draft = makeDraft('anim-1', 500);
      draft.values.set('node-1', { x: 42, opacity: 0.5 });

      const project = makeProject();
      const { edits, committedAddresses } = buildCommitBatch({
        draft,
        project,
        loopStartMs: 0,
        endMs: 2000,
      });

      expect(edits.length).toBeGreaterThanOrEqual(2);
      expect(committedAddresses).toContain('node-1::x@500');
      expect(committedAddresses).toContain('node-1::opacity@500');
    });

    it('includes baselines at loopStart for non-zero timeMs', () => {
      const draft = makeDraft('anim-1', 500);
      draft.values.set('node-1', { x: 42 });

      const project = makeProject();
      const { edits } = buildCommitBatch({
        draft,
        project,
        loopStartMs: 0,
        endMs: 2000,
      });

      const baseline = edits.find(e => e.timeMs === 0 && e.targetId === 'node-1' && e.property === 'x');
      expect(baseline).toBeDefined();
      expect(baseline.value).toBe(0);
    });

    it('preserves an authored loop-start key when a later pose is keyed', () => {
      const project = makeProject();
      project.animations[0].tracks = [{
        targetId: 'node-1',
        property: 'x',
        keyframes: [{
          time: 0,
          value: 15,
          easing: 'linear',
          authoring: { gestureId: 'gesture-start', role: 'authored', source: 'gesture' },
        }],
      }];
      const draft = makeDraft('anim-1', 500);
      draft.values.set('node-1', { x: 42 });
      const draftAuthoring = new Map([['node-1', {
        x: { gestureId: 'gesture-later', role: 'authored', source: 'gesture' },
      }]]);

      const { edits, materializedCount } = buildCommitBatch({
        draft,
        project,
        loopStartMs: 0,
        draftAuthoring,
      });
      expect(edits.filter(edit => edit.targetId === 'node-1' && edit.property === 'x')).toEqual([
        expect.objectContaining({ timeMs: 500, value: 42 }),
      ]);
      expect(materializedCount).toBeUndefined();

      upsertAnimationKeyframes(project, { animationId: 'anim-1', keyframes: edits });
      const keyframes = project.animations[0].tracks[0].keyframes;
      expect(keyframes).toHaveLength(2);
      expect(keyframes[0]).toMatchObject({
        time: 0,
        value: 15,
        authoring: { gestureId: 'gesture-start', role: 'authored' },
      });

      expect(moveKeyframesPreflight(project.animations[0], {
        keyframes: [{ targetId: 'node-1', property: 'x', timeMs: 500 }],
        deltaMs: -250,
      }).valid).toBe(true);
    });

    it('recreates support when re-keying its authored gesture', () => {
      const project = makeProject();
      project.animations[0].tracks = [{
        targetId: 'node-1',
        property: 'x',
        keyframes: [
          { time: 0, value: 0, authoring: { gestureId: 'gesture-old', role: 'support', source: 'gesture' } },
          { time: 500, value: 20, authoring: { gestureId: 'gesture-old', role: 'authored', source: 'gesture' } },
        ],
      }];
      const draft = makeDraft('anim-1', 500);
      draft.values.set('node-1', { x: 42 });
      const draftAuthoring = new Map([['node-1', {
        x: { gestureId: 'gesture-new', role: 'authored', source: 'gesture' },
      }]]);

      const { edits } = buildCommitBatch({ draft, project, loopStartMs: 0, draftAuthoring });
      expect(edits).toEqual(expect.arrayContaining([
        expect.objectContaining({
          timeMs: 0,
          authoring: expect.objectContaining({ gestureId: 'gesture-new', role: 'support' }),
        }),
      ]));
    });

    it('returns empty for null context', () => {
      const draft = makeDraft();
      draft.context = null;
      const { edits } = buildCommitBatch({ draft, project: makeProject(), loopStartMs: 0, endMs: 2000 });
      expect(edits).toHaveLength(0);
    });

    it('includes bone properties', () => {
      const draft = makeDraft('anim-1', 500);
      draft.values.set('bone-1', { rotation: 45 });

      const project = makeProject();
      const { edits } = buildCommitBatch({
        draft,
        project,
        loopStartMs: 0,
        endMs: 2000,
      });

      expect(edits.some(e => e.targetId === 'bone-1' && e.property === 'rotation' && e.value === 45)).toBe(true);
    });

    it('includes constraint properties', () => {
      const draft = makeDraft('anim-1', 500);
      draft.values.set('ik-1', { targetX: 10, targetY: 20 });

      const project = makeProject();
      const { edits } = buildCommitBatch({
        draft,
        project,
        loopStartMs: 0,
        endMs: 2000,
      });

      expect(edits.some(e => e.targetId === 'ik-1' && e.property === 'targetX' && e.value === 10)).toBe(true);
      expect(edits.some(e => e.targetId === 'ik-1' && e.property === 'targetY' && e.value === 20)).toBe(true);
    });
  });

  describe('buildManualKeyBatch', () => {
    it('snapshots current effective values for nodes', () => {
      const keyframeOverrides = new Map([['node-1', { x: 10, y: 20 }]]);
      const project = makeProject();

      const { edits, committedAddresses } = buildManualKeyBatch({
        animationId: 'anim-1',
        targetIds: ['node-1'],
        timeMs: 500,
        loopStartMs: 0,
        project,
        keyframeOverrides,
        restPose: new Map(),
      });

      expect(edits.length).toBeGreaterThanOrEqual(1);
      expect(committedAddresses.some(a => a.startsWith('node-1::'))).toBe(true);
      const xEdit = edits.find(e => e.property === 'x');
      expect(xEdit.value).toBe(10);
    });

    it('falls back to node values when no overrides', () => {
      const keyframeOverrides = new Map();
      const project = makeProject();

      const { edits } = buildManualKeyBatch({
        animationId: 'anim-1',
        targetIds: ['node-1'],
        timeMs: 500,
        loopStartMs: 0,
        project,
        keyframeOverrides,
        restPose: new Map(),
      });

      const xEdit = edits.find(e => e.property === 'x');
      expect(xEdit.value).toBe(0);
    });

    it('does not replace authored loop-start transform keys with supports', () => {
      const project = makeProject();
      project.animations[0].tracks = [{
        targetId: 'bone-1',
        property: 'rotation',
        keyframes: [{
          time: 0,
          value: 12,
          authoring: { gestureId: 'start-key', role: 'authored', source: 'gesture' },
        }],
      }];

      const { edits } = buildManualKeyBatch({
        animationId: 'anim-1',
        targetIds: ['bone-1'],
        timeMs: 500,
        loopStartMs: 0,
        project,
        keyframeOverrides: new Map([['bone-1', { rotation: 45 }]]),
        restPose: new Map(),
        gestureId: 'manual-later',
      });

      expect(edits.some(edit => edit.property === 'rotation' && edit.timeMs === 0)).toBe(false);
      expect(edits).toContainEqual(expect.objectContaining({ property: 'rotation', timeMs: 500, value: 45 }));
    });

    it('smart K keys only channels already animated on the selected target', () => {
      const project = makeProject();
      project.animations[0].tracks = [{
        targetId: 'bone-1',
        property: 'rotation',
        keyframes: [{ time: 500, value: 45 }],
      }];

      const { edits, committedAddresses } = buildManualKeyBatch({
        animationId: 'anim-1',
        targetIds: ['bone-1'],
        timeMs: 0,
        loopStartMs: 0,
        project,
        keyframeOverrides: new Map([['bone-1', { rotation: 10 }]]),
        restPose: new Map(),
        gestureId: 'manual-start',
      });

      expect(edits).toEqual([
        expect.objectContaining({ targetId: 'bone-1', property: 'rotation', timeMs: 0, value: 10 }),
      ]);
      expect(committedAddresses).toEqual(['bone-1::rotation@0']);
    });

    it('smart K defaults a new child bone to rotation without pinning position or scale', () => {
      const project = makeProject();
      project.bones[0].parentId = 'parent-bone';
      project.bones.push({
        id: 'parent-bone',
        name: 'Body',
        parentId: null,
        setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, length: 100 },
      });

      const { edits } = buildManualKeyBatch({
        animationId: 'anim-1',
        targetIds: ['bone-1'],
        timeMs: 0,
        loopStartMs: 0,
        project,
        keyframeOverrides: new Map(),
        restPose: new Map(),
        gestureId: 'manual-child',
      });

      expect(edits.map(edit => edit.property)).toEqual(['rotation']);
    });

    it('handles bones', () => {
      const keyframeOverrides = new Map([['bone-1', { rotation: 30 }]]);
      const project = makeProject();

      const { edits } = buildManualKeyBatch({
        animationId: 'anim-1',
        targetIds: ['bone-1'],
        timeMs: 500,
        loopStartMs: 0,
        project,
        keyframeOverrides,
        restPose: new Map(),
      });

      const rotEdit = edits.find(e => e.property === 'rotation');
      expect(rotEdit.value).toBe(30);
    });

    it('skips unknown targets', () => {
      const project = makeProject();
      const { edits } = buildManualKeyBatch({
        animationId: 'anim-1',
        targetIds: ['nonexistent'],
        timeMs: 500,
        loopStartMs: 0,
        project,
        keyframeOverrides: new Map(),
        restPose: new Map(),
      });
      expect(edits).toHaveLength(0);
    });
  });

  // ── Stage 02: Provenance metadata ───────────────────────────────────────────

  describe('applyPreviewIntent with provenance', () => {
    it('writes metadata to provenance map when gestureId is present', () => {
      const draft = makeDraft();
      const provenance = new Map();
      const intent = {
        animationId: 'anim-1',
        targetId: 'node-1',
        property: 'x',
        value: 42,
        timeMs: 500,
        source: 'gesture',
        gestureId: 'gesture-abc',
        role: 'authored',
        phase: 'preview',
      };
      const result = applyPreviewIntent(draft, intent, provenance);
      expect(result.valid).toBe(true);
      const meta = provenance.get('node-1')?.x;
      expect(meta).toBeDefined();
      expect(meta.gestureId).toBe('gesture-abc');
      expect(meta.role).toBe('authored');
      expect(meta.source).toBe('gesture');
    });

    it('skips provenance when gestureId is absent', () => {
      const draft = makeDraft();
      const provenance = new Map();
      const result = applyPreviewIntent(draft, {
        animationId: 'anim-1',
        targetId: 'node-1',
        property: 'x',
        value: 42,
        timeMs: 500,
        source: 'inspector',
        phase: 'preview',
      }, provenance);
      expect(result.valid).toBe(true);
      expect(provenance.size).toBe(0);
    });

    it('value writes to draft regardless of provenance', () => {
      const draft = makeDraft();
      const provenance = new Map();
      applyPreviewIntent(draft, {
        animationId: 'anim-1',
        targetId: 'node-1',
        property: 'x',
        value: 99,
        timeMs: 500,
        source: 'gesture',
        gestureId: 'g-1',
        role: 'authored',
        phase: 'preview',
      }, provenance);
      expect(draft.values.get('node-1')).toEqual({ x: 99 });
    });
  });

  describe('buildCommitBatch with provenance', () => {
    it('includes authoring metadata on edits from provenance map', () => {
      const draft = makeDraft('anim-1', 500);
      draft.values.set('node-1', { x: 42 });

      const draftAuthoring = new Map();
      draftAuthoring.set('node-1', {
        x: { gestureId: 'gesture-abc', role: 'authored', source: 'gesture' },
      });

      const project = makeProject();
      const { edits } = buildCommitBatch({ draft, project, loopStartMs: 0, draftAuthoring });
      const xEdit = edits.find(e => e.property === 'x' && e.timeMs === 500);
      expect(xEdit.authoring).toBeDefined();
      expect(xEdit.authoring.gestureId).toBe('gesture-abc');
      expect(xEdit.authoring.role).toBe('authored');
    });

    it('marks support baselines with role support and same gestureId', () => {
      const draft = makeDraft('anim-1', 500);
      draft.values.set('node-1', { x: 42 });

      const draftAuthoring = new Map();
      draftAuthoring.set('node-1', {
        x: { gestureId: 'gesture-abc', role: 'authored', source: 'gesture' },
      });

      const project = makeProject();
      const { edits } = buildCommitBatch({ draft, project, loopStartMs: 0, draftAuthoring });
      const supportEdit = edits.find(e => e.timeMs === 0 && e.targetId === 'node-1' && e.property === 'x');
      expect(supportEdit).toBeDefined();
      expect(supportEdit.authoring).toBeDefined();
      expect(supportEdit.authoring.role).toBe('support');
      expect(supportEdit.authoring.gestureId).toBe('gesture-abc');
    });

    it('committedAddresses contains only authored addresses (not support)', () => {
      const draft = makeDraft('anim-1', 500);
      draft.values.set('node-1', { x: 42 });

      const project = makeProject();
      const { committedAddresses } = buildCommitBatch({ draft, project, loopStartMs: 0 });
      expect(committedAddresses).toHaveLength(1);
      expect(committedAddresses[0]).toBe('node-1::x@500');
    });

    it('reports materializedCount', () => {
      const draft = makeDraft('anim-1', 500);
      draft.values.set('node-1', { x: 42 });

      const project = makeProject();
      const { materializedCount } = buildCommitBatch({ draft, project, loopStartMs: 0 });
      expect(materializedCount).toBe(1);
    });

    it('does not create duplicate support when timeMs equals loopStartMs', () => {
      const draft = makeDraft('anim-1', 0);
      draft.values.set('node-1', { x: 42 });

      const project = makeProject();
      const { edits, materializedCount } = buildCommitBatch({ draft, project, loopStartMs: 0 });
      expect(edits).toHaveLength(1);
      expect(materializedCount).toBeUndefined();
    });

    it('keeps an authored child key visible when a parent pose commit updates it as derived', () => {
      const project = makeProject();
      project.bones.push({
        id: 'bone-child',
        name: 'Child',
        parentId: 'bone-1',
        setup: { x: 0, y: 50, rotation: 0, scaleX: 1, scaleY: 1 },
      });
      project.animations[0].tracks = [
        {
          targetId: 'bone-1',
          property: 'rotation',
          keyframes: [{
            time: 500,
            value: 10,
            easing: 'linear',
            authoring: { gestureId: 'old-parent-pose', role: 'authored', source: 'pose.rotate' },
          }],
        },
        {
          targetId: 'bone-child',
          property: 'rotation',
          keyframes: [{
            time: 500,
            value: 25,
            easing: 'linear',
            authoring: { gestureId: 'child-user-pose', role: 'authored', source: 'pose.rotate' },
          }],
        },
      ];

      const draft = makeDraft('anim-1', 500);
      draft.values.set('bone-1', { rotation: 20 });
      draft.values.set('bone-child', { rotation: 35 });
      const draftAuthoring = new Map([
        ['bone-1', {
          rotation: { gestureId: 'new-parent-pose', role: 'authored', source: 'pose.rotate' },
        }],
        ['bone-child', {
          rotation: { gestureId: 'new-parent-pose', role: 'derived', source: 'pose.rotate' },
        }],
      ]);

      const { edits } = buildCommitBatch({ draft, project, loopStartMs: 0, draftAuthoring });
      upsertAnimationKeyframes(project, { animationId: 'anim-1', keyframes: edits });

      const childKey = project.animations[0].tracks
        .find(track => track.targetId === 'bone-child' && track.property === 'rotation')
        .keyframes.find(keyframe => keyframe.time === 500);
      expect(childKey.value).toBe(35);
      expect(childKey.authoring).toEqual({
        gestureId: 'child-user-pose',
        role: 'authored',
        source: 'pose.rotate',
      });
      expect(isTimelineVisibleKeyframe(childKey)).toBe(true);
    });
  });

  describe('getManualKeyProperties / core profile', () => {
    it('clean K on mesh node does not include mesh_verts, opacity, visible', () => {
      const project = makeProject();
      const keyframeOverrides = new Map([['node-1', { x: 10, y: 20 }]]);
      const { edits } = buildManualKeyBatch({
        animationId: 'anim-1',
        targetIds: ['node-1'],
        timeMs: 500,
        loopStartMs: 0,
        project,
        keyframeOverrides,
        restPose: new Map(),
      });
      const properties = edits.filter(e => e.timeMs === 500).map(e => e.property);
      expect(properties).toEqual(['x', 'y', 'rotation', 'scaleX', 'scaleY']);
    });

    it('clean K on bone includes only core transform', () => {
      const project = makeProject();
      const keyframeOverrides = new Map([['bone-1', { rotation: 30 }]]);
      const { edits } = buildManualKeyBatch({
        animationId: 'anim-1',
        targetIds: ['bone-1'],
        timeMs: 500,
        loopStartMs: 0,
        project,
        keyframeOverrides,
        restPose: new Map(),
      });
      const properties = edits.filter(e => e.timeMs === 500).map(e => e.property);
      expect(properties).toEqual(['x', 'y', 'rotation', 'scaleX', 'scaleY']);
    });

    it('clean K on constraint includes only targetX, targetY', () => {
      const project = makeProject();
      const { edits } = buildManualKeyBatch({
        animationId: 'anim-1',
        targetIds: ['ik-1'],
        timeMs: 500,
        loopStartMs: 0,
        project,
        keyframeOverrides: new Map(),
        restPose: new Map(),
      });
      const properties = edits.filter(e => e.timeMs === 500).map(e => e.property);
      expect(properties).toEqual(['targetX', 'targetY']);
    });

    it('clean K on mesh node excludes blendShape channels', () => {
      const project = makeProject({
        nodes: [{
          id: 'node-1',
          type: 'part',
          name: 'Head',
          parent: null,
          transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
          opacity: 1,
          visible: true,
          mesh: {
            geometry: {
              vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
              uvs: [0, 0, 1, 0, 0, 1, 1, 1],
              indices: [0, 1, 2, 1, 3, 2],
            },
          },
          blendShapes: [{ id: 'bs1' }, { id: 'bs2' }],
          blendShapeValues: { bs1: 0, bs2: 0 },
        }],
      });
      const { edits } = buildManualKeyBatch({
        animationId: 'anim-1',
        targetIds: ['node-1'],
        timeMs: 500,
        loopStartMs: 0,
        project,
        keyframeOverrides: new Map(),
        restPose: new Map(),
      });
      const properties = edits.filter(e => e.timeMs === 500).map(e => e.property);
      expect(properties).not.toContain('mesh_verts');
      expect(properties).not.toContain('blendShape:bs1');
      expect(properties).not.toContain('blendShape:bs2');
      expect(properties).not.toContain('opacity');
      expect(properties).not.toContain('visible');
    });
  });

  describe('describeKeyScope', () => {
    it('returns draft description when dirty', () => {
      expect(describeKeyScope({ dirty: true, hasSelection: true })).toBe('Key changed channels');
    });

    it('returns clean description when not dirty but has selection', () => {
      expect(describeKeyScope({ dirty: false, hasSelection: true })).toBe('Key animated channels for selection');
    });

    it('returns null when no selection and no draft', () => {
      expect(describeKeyScope({ dirty: false, hasSelection: false })).toBeNull();
    });
  });

  describe('buildManualKeyBatch with provenance', () => {
    it('includes authoring metadata when gestureId is provided', () => {
      const project = makeProject();
      const { edits } = buildManualKeyBatch({
        animationId: 'anim-1',
        targetIds: ['node-1'],
        timeMs: 500,
        loopStartMs: 0,
        project,
        keyframeOverrides: new Map([['node-1', { x: 10 }]]),
        restPose: new Map(),
        gestureId: 'manual-gesture',
        source: 'manual-key',
      });
      const xEdit = edits.find(e => e.property === 'x' && e.timeMs === 500);
      expect(xEdit.authoring).toBeDefined();
      expect(xEdit.authoring.gestureId).toBe('manual-gesture');
      expect(xEdit.authoring.role).toBe('authored');
      expect(xEdit.authoring.source).toBe('manual-key');
    });

    it('support baseline has role support with same gestureId', () => {
      const project = makeProject();
      const { edits } = buildManualKeyBatch({
        animationId: 'anim-1',
        targetIds: ['node-1'],
        timeMs: 500,
        loopStartMs: 0,
        project,
        keyframeOverrides: new Map([['node-1', { x: 10 }]]),
        restPose: new Map(),
        gestureId: 'manual-gesture',
        source: 'manual-key',
      });
      const support = edits.find(e => e.timeMs === 0 && e.property === 'x');
      expect(support.authoring).toBeDefined();
      expect(support.authoring.role).toBe('support');
      expect(support.authoring.gestureId).toBe('manual-gesture');
    });

    it('omits authoring when gestureId is not provided', () => {
      const project = makeProject();
      const { edits } = buildManualKeyBatch({
        animationId: 'anim-1',
        targetIds: ['node-1'],
        timeMs: 500,
        loopStartMs: 0,
        project,
        keyframeOverrides: new Map([['node-1', { x: 10 }]]),
        restPose: new Map(),
      });
      const xEdit = edits.find(e => e.property === 'x');
      expect(xEdit.authoring).toBeUndefined();
    });
  });
});
