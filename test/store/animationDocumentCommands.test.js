import { beforeEach, describe, expect, it } from 'vitest';
import { useAnimationStore } from '@/store/animationStore';
import { clearHistory, undoCount } from '@/store/undoHistory';
import { useProjectStore } from '@/store/projectStore';
import {
  validateAnimationEditBatch,
} from '@/domain/animationKeyframeBatchCommands.js';

function resetStores() {
  clearHistory();
  useAnimationStore.getState().resetPlayback();
  useProjectStore.getState().resetProject();
}

describe('animation document commands', () => {
  beforeEach(() => {
    resetStores();
  });

  it('creates and edits animation data through the store actions', () => {
    const store = useProjectStore.getState();

    const createResult = store.createAnimationClip({
      animationId: 'anim-1',
      name: 'Walk',
      durationMs: 1000,
      fps: 30,
    });

    expect(createResult.changed).toBe(true);
    expect(undoCount()).toBe(1);

    store.addAnimationMarker({
      animationId: 'anim-1',
      markerId: 'marker-1',
      timeMs: 250,
      label: 'Beat',
    });

    store.upsertAnimationKeyframe({
      animationId: 'anim-1',
      targetId: 'node-1',
      property: 'x',
      timeMs: 100,
      value: 12,
      easing: 'linear',
    });

    store.moveAnimationKeyframes({
      animationId: 'anim-1',
      keyframes: [{ targetId: 'node-1', timeMs: 100 }],
      deltaMs: 25,
    });

    store.setAnimationKeyframeEasing({
      animationId: 'anim-1',
      keyframes: [{ targetId: 'node-1', timeMs: 125 }],
      easing: 'ease-in',
    });

    store.addAnimationAudioTrack({
      animationId: 'anim-1',
      audioTrackId: 'audio-1',
      name: 'Voice',
      audioDurationMs: 2400,
      audioStartMs: 100,
      audioEndMs: 1200,
      timelineStartMs: 0,
    });

    store.updateAnimationAudioTrack({
      animationId: 'anim-1',
      audioTrackId: 'audio-1',
      patch: {
        name: 'Voice A',
        timelineStartMs: 200,
      },
    });

    store.deleteAnimationKeyframes({
      animationId: 'anim-1',
      keyframes: [{ targetId: 'node-1', timeMs: 125 }],
    });

    store.removeAnimationAudioTrack({
      animationId: 'anim-1',
      audioTrackId: 'audio-1',
    });

    const animation = useProjectStore.getState().project.animations[0];
    expect(animation).toMatchObject({
      id: 'anim-1',
      name: 'Walk',
      duration: 1000,
      fps: 30,
      markers: [{ id: 'marker-1', time: 250, label: 'Beat' }],
      audioTracks: [],
    });
    expect(animation.tracks).toHaveLength(0);
  });

  it('bulk-upserts keyframes as one named undo entry and ignores a full no-op', () => {
    const store = useProjectStore.getState();
    store.createAnimationClip({ animationId: 'anim-1' });
    const beforeBulk = undoCount();
    const payload = {
      animationId: 'anim-1',
      keyframes: [
        { targetId: 'node-1', property: 'x', timeMs: 100, value: 10, easing: 'linear' },
        { targetId: 'node-1', property: 'y', timeMs: 100, value: 20, easing: 'linear' },
      ],
    };

    expect(store.upsertAnimationKeyframes(payload).changed).toBe(true);
    expect(undoCount()).toBe(beforeBulk + 1);
    expect(store.upsertAnimationKeyframes(payload).changed).toBe(false);
    expect(undoCount()).toBe(beforeBulk + 1);
  });

  it('keeps keyframe movement guarded against negative time', () => {
    const store = useProjectStore.getState();

    store.createAnimationClip({
      animationId: 'anim-1',
      durationMs: 1000,
      fps: 24,
    });
    store.upsertAnimationKeyframe({
      animationId: 'anim-1',
      targetId: 'node-1',
      property: 'x',
      timeMs: 100,
      value: 1,
      easing: 'linear',
    });

    expect(() => {
      store.moveAnimationKeyframes({
        animationId: 'anim-1',
        keyframes: [{ targetId: 'node-1', timeMs: 100 }],
        deltaMs: -200,
      });
    }).toThrow('Keyframe time cannot be negative');
  });

  it('moves authored keys without moving hidden support and replaces support at frame 0', () => {
    const store = useProjectStore.getState();
    store.createAnimationClip({ animationId: 'anim-1', durationMs: 1000, fps: 24 });
    store.upsertAnimationKeyframes({
      animationId: 'anim-1',
      keyframes: [
        { targetId: 'bone-5', property: 'rotation', timeMs: 0, value: 0, authoring: { gestureId: 'g1', role: 'support', source: 'pose.rotate' } },
        { targetId: 'bone-5', property: 'rotation', timeMs: 500, value: 30, authoring: { gestureId: 'g1', role: 'authored', source: 'pose.rotate' } },
      ],
    });
    store.setAnimationTargetBoomerang({ animationId: 'anim-1', targetId: 'bone-5', enabled: true });

    store.moveAnimationKeyframes({
      animationId: 'anim-1',
      keyframes: [{ targetId: 'bone-5', property: 'rotation', timeMs: 500 }],
      deltaMs: -250,
    });
    let keyframes = useProjectStore.getState().project.animations[0].tracks[0].keyframes;
    expect(keyframes.map(keyframe => [keyframe.time, keyframe.authoring.role])).toEqual([
      [0, 'support'],
      [250, 'authored'],
    ]);
    expect(useProjectStore.getState().project.animations[0].boomerangTargets['bone-5'].sourceEndMs).toBe(250);

    store.moveAnimationKeyframes({
      animationId: 'anim-1',
      keyframes: [{ targetId: 'bone-5', property: 'rotation', timeMs: 250 }],
      deltaMs: -250,
    });
    keyframes = useProjectStore.getState().project.animations[0].tracks[0].keyframes;
    expect(keyframes).toHaveLength(1);
    expect(keyframes[0]).toMatchObject({ time: 0, value: 30, authoring: { role: 'authored' } });
    expect(useProjectStore.getState().project.animations[0].boomerangTargets).toBeUndefined();
  });

  it('keeps a shared support baseline while later authored keys remain', () => {
    const store = useProjectStore.getState();
    store.createAnimationClip({ animationId: 'anim-1', durationMs: 1000, fps: 24 });
    store.upsertAnimationKeyframes({
      animationId: 'anim-1',
      keyframes: [
        { targetId: 'bone-5', property: 'rotation', timeMs: 0, value: 0, authoring: { gestureId: 'g1', role: 'support', source: 'pose.rotate' } },
        { targetId: 'bone-5', property: 'rotation', timeMs: 250, value: 15, authoring: { gestureId: 'g1', role: 'authored', source: 'pose.rotate' } },
        { targetId: 'bone-5', property: 'rotation', timeMs: 500, value: 30, authoring: { gestureId: 'g2', role: 'authored', source: 'pose.rotate' } },
      ],
    });

    store.deleteAnimationKeyframes({
      animationId: 'anim-1',
      keyframes: [{ targetId: 'bone-5', property: 'rotation', timeMs: 250 }],
    });
    let keyframes = useProjectStore.getState().project.animations[0].tracks[0].keyframes;
    expect(keyframes.map(keyframe => [keyframe.time, keyframe.authoring.role])).toEqual([
      [0, 'support'],
      [500, 'authored'],
    ]);

    store.deleteAnimationKeyframes({
      animationId: 'anim-1',
      keyframes: [{ targetId: 'bone-5', property: 'rotation', timeMs: 500 }],
    });
    expect(useProjectStore.getState().project.animations[0].tracks).toHaveLength(0);
  });

  it('rejects upsert when timeMs exceeds animation duration', () => {
    const store = useProjectStore.getState();
    store.createAnimationClip({ animationId: 'anim-1', durationMs: 500 });

    expect(() => {
      store.upsertAnimationKeyframe({
        animationId: 'anim-1',
        targetId: 'node-1',
        property: 'x',
        timeMs: 600,
        value: 10,
      });
    }).toThrow('Keyframe time exceeds animation duration');
  });

  it('rejects invalid easing preset in upsert', () => {
    const store = useProjectStore.getState();
    store.createAnimationClip({ animationId: 'anim-1', durationMs: 1000 });

    expect(() => {
      store.upsertAnimationKeyframe({
        animationId: 'anim-1',
        targetId: 'node-1',
        property: 'x',
        timeMs: 100,
        value: 10,
        easing: 'bogus',
      });
    }).toThrow('Invalid easing');
  });

  it('rejects invalid easing array in upsert', () => {
    const store = useProjectStore.getState();
    store.createAnimationClip({ animationId: 'anim-1', durationMs: 1000 });

    expect(() => {
      store.upsertAnimationKeyframe({
        animationId: 'anim-1',
        targetId: 'node-1',
        property: 'x',
        timeMs: 100,
        value: 10,
        easing: [0.42, 0, 0.58],
      });
    }).toThrow('Invalid easing');
  });

  it('rejects move when result exceeds animation duration', () => {
    const store = useProjectStore.getState();
    store.createAnimationClip({ animationId: 'anim-1', durationMs: 500 });
    store.upsertAnimationKeyframe({
      animationId: 'anim-1',
      targetId: 'node-1',
      property: 'x',
      timeMs: 400,
      value: 10,
    });

    expect(() => {
      store.moveAnimationKeyframes({
        animationId: 'anim-1',
        keyframes: [{ targetId: 'node-1', timeMs: 400 }],
        deltaMs: 200,
      });
    }).toThrow('Keyframe move would exceed animation duration');
  });

  it('detects no-op for cubic easing arrays (structural equality)', () => {
    const store = useProjectStore.getState();
    store.createAnimationClip({ animationId: 'anim-1', durationMs: 1000 });
    store.upsertAnimationKeyframe({
      animationId: 'anim-1',
      targetId: 'node-1',
      property: 'x',
      timeMs: 100,
      value: 10,
      easing: [0.42, 0, 0.58, 1],
    });

    const beforeUndo = undoCount();
    const result = store.setAnimationKeyframeEasing({
      animationId: 'anim-1',
      keyframes: [{ targetId: 'node-1', timeMs: 100 }],
      easing: [0.42, 0, 0.58, 1],
    });
    expect(result.changed).toBe(false);
    expect(undoCount()).toBe(beforeUndo);
  });
});

describe('validateAnimationEditBatch', () => {
  beforeEach(() => {
    resetStores();
  });

  it('returns valid for empty batch', () => {
    const project = useProjectStore.getState().project;
    expect(validateAnimationEditBatch(project, []).valid).toBe(true);
    expect(validateAnimationEditBatch(project, null).valid).toBe(true);
  });

  it('rejects edit with unknown animationId', () => {
    const project = useProjectStore.getState().project;
    const result = validateAnimationEditBatch(project, [
      { animationId: 'missing', targetId: 'n1', property: 'x', timeMs: 0, value: 0 },
    ]);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('rejects edit with timeMs exceeding duration', () => {
    const store = useProjectStore.getState();
    store.createAnimationClip({ animationId: 'a1', durationMs: 500 });
    const project = useProjectStore.getState().project;

    const result = validateAnimationEditBatch(project, [
      { animationId: 'a1', targetId: 'n1', property: 'x', timeMs: 600, value: 0 },
    ]);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('exceeds animation duration');
  });

  it('rejects edit with invalid easing', () => {
    const store = useProjectStore.getState();
    store.createAnimationClip({ animationId: 'a1', durationMs: 1000 });
    const project = useProjectStore.getState().project;

    const result = validateAnimationEditBatch(project, [
      { animationId: 'a1', targetId: 'n1', property: 'x', timeMs: 100, value: 0, easing: 'bogus' },
    ]);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid easing');
  });

  it('accepts valid batch with multiple edits', () => {
    const store = useProjectStore.getState();
    store.createAnimationClip({ animationId: 'a1', durationMs: 1000 });
    const project = useProjectStore.getState().project;

    const result = validateAnimationEditBatch(project, [
      { animationId: 'a1', targetId: 'n1', property: 'x', timeMs: 100, value: 10 },
      { animationId: 'a1', targetId: 'n1', property: 'y', timeMs: 100, value: 20 },
      { animationId: 'a1', targetId: 'n1', property: 'opacity', timeMs: 200, value: 0.5 },
    ]);
    expect(result.valid).toBe(true);
  });
});

describe('editKeyframeBatch (K7)', () => {
  beforeEach(() => {
    resetStores();
  });

  it('applies atomic batch edit', () => {
    const store = useProjectStore.getState();
    store.createAnimationClip({ animationId: 'a1', durationMs: 1000 });

    const result = store.upsertAnimationKeyframes({
      animationId: 'a1',
      keyframes: [
        { targetId: 'n1', property: 'x', timeMs: 100, value: 10, easing: 'linear' },
      ],
    });
    expect(result.changed).toBe(true);
  });

  it('throws on invalid batch without partial mutation', () => {
    const store = useProjectStore.getState();
    store.createAnimationClip({ animationId: 'a1', durationMs: 500 });

    expect(() => {
      store.upsertAnimationKeyframes({
        animationId: 'a1',
        keyframes: [
          { targetId: 'n1', property: 'x', timeMs: 100, value: 10 },
          { targetId: 'n1', property: 'x', timeMs: 600, value: 20 },
        ],
      });
    }).toThrow('Keyframe time exceeds animation duration');

    const animation = useProjectStore.getState().project.animations[0];
    expect(animation.tracks).toHaveLength(0);
  });

  it('moves and edits an existing keyframe atomically', () => {
    const store = useProjectStore.getState();
    store.createAnimationClip({ animationId: 'a1', durationMs: 500 });
    store.upsertAnimationKeyframe({
      animationId: 'a1', targetId: 'n1', property: 'x',
      timeMs: 100, value: 10, easing: 'linear',
    });

    const result = store.editAnimationKeyframes({
      animationId: 'a1',
      edits: [{
        targetId: 'n1', property: 'x', originalTimeMs: 100,
        timeMs: 200, value: 20, easing: [0.2, 0.3, 0.8, 0.9],
      }],
    });

    expect(result.changed).toBe(true);
    expect(useProjectStore.getState().project.animations[0].tracks[0].keyframes)
      .toEqual([{ time: 200, value: 20, easing: [0.2, 0.3, 0.8, 0.9] }]);
  });

  it('rejects a move collision without partial mutation', () => {
    const store = useProjectStore.getState();
    store.createAnimationClip({ animationId: 'a1', durationMs: 500 });
    store.upsertAnimationKeyframes({
      animationId: 'a1',
      keyframes: [
        { targetId: 'n1', property: 'x', timeMs: 100, value: 10 },
        { targetId: 'n1', property: 'x', timeMs: 200, value: 20 },
      ],
    });

    expect(() => store.editAnimationKeyframes({
      animationId: 'a1',
      edits: [{
        targetId: 'n1', property: 'x', originalTimeMs: 100,
        timeMs: 200, value: 99,
      }],
    })).toThrow('collide');

    expect(
      useProjectStore.getState().project.animations[0].tracks[0].keyframes.map(kf => [kf.time, kf.value]),
    ).toEqual([[100, 10], [200, 20]]);
  });
});

describe('keyframe provenance (Stage 01)', () => {
  beforeEach(() => {
    resetStores();
  });

  it('stores and preserves authoring metadata on upsert', () => {
    const store = useProjectStore.getState();
    store.createAnimationClip({ animationId: 'a1', durationMs: 1000 });

    store.upsertAnimationKeyframe({
      animationId: 'a1', targetId: 'n1', property: 'x',
      timeMs: 100, value: 10,
      authoring: { gestureId: 'g1', role: 'authored', source: 'pose' },
    });

    const kf = useProjectStore.getState().project.animations[0].tracks[0].keyframes[0];
    expect(kf.authoring).toEqual({ gestureId: 'g1', role: 'authored', source: 'pose' });
  });

  it('rejects invalid authoring metadata before mutating the document', () => {
    const store = useProjectStore.getState();
    store.createAnimationClip({ animationId: 'a1', durationMs: 1000 });

    expect(() => store.upsertAnimationKeyframe({
      animationId: 'a1', targetId: 'n1', property: 'x',
      timeMs: 100, value: 10,
      authoring: { gestureId: 'g1', role: 'unknown', source: 'pose' },
    })).toThrow('Invalid keyframe authoring');

    expect(useProjectStore.getState().project.animations[0].tracks).toEqual([]);
  });

  it('preserves authoring metadata on bulk upsert', () => {
    const store = useProjectStore.getState();
    store.createAnimationClip({ animationId: 'a1', durationMs: 1000 });

    store.upsertAnimationKeyframes({
      animationId: 'a1',
      keyframes: [
        { targetId: 'n1', property: 'x', timeMs: 100, value: 10, authoring: { gestureId: 'g1', role: 'authored', source: 'pose' } },
        { targetId: 'n1', property: 'y', timeMs: 100, value: 20, authoring: { gestureId: 'g1', role: 'derived', source: 'pose' } },
      ],
    });

    const trackX = useProjectStore.getState().project.animations[0].tracks.find(t => t.property === 'x');
    const trackY = useProjectStore.getState().project.animations[0].tracks.find(t => t.property === 'y');
    expect(trackX.keyframes[0].authoring).toEqual({ gestureId: 'g1', role: 'authored', source: 'pose' });
    expect(trackY.keyframes[0].authoring).toEqual({ gestureId: 'g1', role: 'derived', source: 'pose' });
  });

  it('legacy upsert without authoring preserves existing metadata on no-op', () => {
    const store = useProjectStore.getState();
    store.createAnimationClip({ animationId: 'a1', durationMs: 1000 });

    store.upsertAnimationKeyframe({
      animationId: 'a1', targetId: 'n1', property: 'x',
      timeMs: 100, value: 10, easing: 'linear',
      authoring: { gestureId: 'g1', role: 'authored', source: 'pose' },
    });

    store.upsertAnimationKeyframe({
      animationId: 'a1', targetId: 'n1', property: 'x',
      timeMs: 100, value: 10, easing: 'linear',
    });

    const kf = useProjectStore.getState().project.animations[0].tracks[0].keyframes[0];
    expect(kf.authoring).toEqual({ gestureId: 'g1', role: 'authored', source: 'pose' });
  });

  it('promotes derived keyframe by providing authored authoring', () => {
    const store = useProjectStore.getState();
    store.createAnimationClip({ animationId: 'a1', durationMs: 1000 });

    store.upsertAnimationKeyframe({
      animationId: 'a1', targetId: 'n1', property: 'x',
      timeMs: 100, value: 10,
      authoring: { gestureId: 'g1', role: 'derived', source: 'pose' },
    });

    store.upsertAnimationKeyframe({
      animationId: 'a1', targetId: 'n1', property: 'x',
      timeMs: 100, value: 99,
      authoring: { gestureId: 'g2', role: 'authored', source: 'manual' },
    });

    const kf = useProjectStore.getState().project.animations[0].tracks[0].keyframes[0];
    expect(kf.value).toBe(99);
    expect(kf.authoring).toEqual({ gestureId: 'g2', role: 'authored', source: 'manual' });
  });

  it('replaces superseded derived and support keys when an authored source recommits', () => {
    const store = useProjectStore.getState();
    store.createAnimationClip({ animationId: 'a1', durationMs: 1000 });
    store.upsertAnimationKeyframes({
      animationId: 'a1',
      keyframes: [
        { targetId: 'root', property: 'rotation', timeMs: 100, value: 10, authoring: { gestureId: 'g1', role: 'authored', source: 'pose.rotate' } },
        { targetId: 'child', property: 'x', timeMs: 100, value: 20, authoring: { gestureId: 'g1', role: 'derived', source: 'pose.rotate' } },
        { targetId: 'child', property: 'x', timeMs: 0, value: 0, authoring: { gestureId: 'g1', role: 'support', source: 'pose.rotate' } },
      ],
    });

    store.upsertAnimationKeyframes({
      animationId: 'a1',
      keyframes: [
        { targetId: 'root', property: 'rotation', timeMs: 100, value: 30, authoring: { gestureId: 'g2', role: 'authored', source: 'pose.rotate' } },
      ],
    });

    const tracks = useProjectStore.getState().project.animations[0].tracks;
    expect(tracks.find((track) => track.targetId === 'child')).toBeUndefined();
    expect(tracks.find((track) => track.targetId === 'root').keyframes[0]).toMatchObject({
      value: 30,
      authoring: { gestureId: 'g2', role: 'authored', source: 'pose.rotate' },
    });
  });

  it('group move expands to derived keyframes of same gesture', () => {
    const store = useProjectStore.getState();
    store.createAnimationClip({ animationId: 'a1', durationMs: 1000 });

    store.upsertAnimationKeyframes({
      animationId: 'a1',
      keyframes: [
        { targetId: 'n1', property: 'x', timeMs: 100, value: 10, authoring: { gestureId: 'g1', role: 'authored', source: 'pose' } },
        { targetId: 'n1', property: 'y', timeMs: 100, value: 20, authoring: { gestureId: 'g1', role: 'derived', source: 'pose' } },
      ],
    });

    store.moveAnimationKeyframes({
      animationId: 'a1',
      keyframes: [{ targetId: 'n1', timeMs: 100 }],
      deltaMs: 50,
    });

    const trackX = useProjectStore.getState().project.animations[0].tracks.find(t => t.property === 'x');
    const trackY = useProjectStore.getState().project.animations[0].tracks.find(t => t.property === 'y');
    expect(trackX.keyframes[0].time).toBe(150);
    expect(trackY.keyframes[0].time).toBe(150);
  });

  it('group delete removes derived keyframes of same gesture', () => {
    const store = useProjectStore.getState();
    store.createAnimationClip({ animationId: 'a1', durationMs: 1000 });

    store.upsertAnimationKeyframes({
      animationId: 'a1',
      keyframes: [
        { targetId: 'n1', property: 'x', timeMs: 100, value: 10, authoring: { gestureId: 'g1', role: 'authored', source: 'pose' } },
        { targetId: 'n1', property: 'y', timeMs: 100, value: 20, authoring: { gestureId: 'g1', role: 'derived', source: 'pose' } },
      ],
    });

    store.deleteAnimationKeyframes({
      animationId: 'a1',
      keyframes: [{ targetId: 'n1', timeMs: 100 }],
    });

    const anim = useProjectStore.getState().project.animations[0];
    expect(anim.tracks).toHaveLength(0);
  });

  it('group easing updates derived keyframes of same gesture', () => {
    const store = useProjectStore.getState();
    store.createAnimationClip({ animationId: 'a1', durationMs: 1000 });

    store.upsertAnimationKeyframes({
      animationId: 'a1',
      keyframes: [
        { targetId: 'n1', property: 'x', timeMs: 100, value: 10, easing: 'linear', authoring: { gestureId: 'g1', role: 'authored', source: 'pose' } },
        { targetId: 'n1', property: 'y', timeMs: 100, value: 20, easing: 'linear', authoring: { gestureId: 'g1', role: 'derived', source: 'pose' } },
      ],
    });

    store.setAnimationKeyframeEasing({
      animationId: 'a1',
      keyframes: [{ targetId: 'n1', timeMs: 100 }],
      easing: 'ease-in',
    });

    const trackX = useProjectStore.getState().project.animations[0].tracks.find(t => t.property === 'x');
    const trackY = useProjectStore.getState().project.animations[0].tracks.find(t => t.property === 'y');
    expect(trackX.keyframes[0].easing).toBe('ease-in');
    expect(trackY.keyframes[0].easing).toBe('ease-in');
  });

  it('promoted keyframe is not affected by old gesture group operations', () => {
    const store = useProjectStore.getState();
    store.createAnimationClip({ animationId: 'a1', durationMs: 1000 });

    store.upsertAnimationKeyframes({
      animationId: 'a1',
      keyframes: [
        { targetId: 'n1', property: 'x', timeMs: 100, value: 10, authoring: { gestureId: 'g1', role: 'authored', source: 'pose' } },
        { targetId: 'n1', property: 'y', timeMs: 100, value: 20, authoring: { gestureId: 'g1', role: 'derived', source: 'pose' } },
      ],
    });

    store.upsertAnimationKeyframe({
      animationId: 'a1', targetId: 'n1', property: 'y',
      timeMs: 100, value: 99,
      authoring: { gestureId: 'g2', role: 'authored', source: 'manual' },
    });

    store.moveAnimationKeyframes({
      animationId: 'a1',
      keyframes: [{ targetId: 'n1', timeMs: 100 }],
      deltaMs: 50,
    });

    const trackX = useProjectStore.getState().project.animations[0].tracks.find(t => t.property === 'x');
    const trackY = useProjectStore.getState().project.animations[0].tracks.find(t => t.property === 'y');
    expect(trackX.keyframes[0].time).toBe(150);
    expect(trackY.keyframes[0].time).toBe(150);
    expect(trackY.keyframes[0].value).toBe(99);
  });

  it('legacy keyframes without authoring are not affected by group expansion', () => {
    const store = useProjectStore.getState();
    store.createAnimationClip({ animationId: 'a1', durationMs: 1000 });

    store.upsertAnimationKeyframes({
      animationId: 'a1',
      keyframes: [
        { targetId: 'n1', property: 'x', timeMs: 100, value: 10 },
        { targetId: 'n1', property: 'y', timeMs: 100, value: 20 },
      ],
    });

    store.deleteAnimationKeyframes({
      animationId: 'a1',
      keyframes: [{ targetId: 'n1', timeMs: 100 }],
    });

    const anim = useProjectStore.getState().project.animations[0];
    expect(anim.tracks).toHaveLength(0);
  });

  it('setAnimationTargetBoomerang enable/disable round-trip', () => {
    const store = useProjectStore.getState();
    store.createAnimationClip({ animationId: 'a1', durationMs: 2000, fps: 30 });

    store.upsertAnimationKeyframes({
      animationId: 'a1',
      keyframes: [
        { targetId: 'n1', property: 'x', timeMs: 0, value: 0 },
        { targetId: 'n1', property: 'x', timeMs: 1400, value: 100 },
      ],
    });

    const enableResult = store.setAnimationTargetBoomerang({
      animationId: 'a1', targetId: 'n1', enabled: true,
    });
    expect(enableResult.changed).toBe(true);
    const anim = useProjectStore.getState().project.animations[0];
    expect(anim.boomerangTargets).toBeDefined();
    expect(anim.boomerangTargets.n1.sourceEndMs).toBe(1400);

    const idleEnable = store.setAnimationTargetBoomerang({
      animationId: 'a1', targetId: 'n1', enabled: true,
    });
    expect(idleEnable.changed).toBe(false);

    const disableResult = store.setAnimationTargetBoomerang({
      animationId: 'a1', targetId: 'n1', enabled: false,
    });
    expect(disableResult.changed).toBe(true);
    const afterDisable = useProjectStore.getState().project.animations[0];
    expect(afterDisable.boomerangTargets).toBeUndefined();

    const idleDisable = store.setAnimationTargetBoomerang({
      animationId: 'a1', targetId: 'n1', enabled: false,
    });
    expect(idleDisable.changed).toBe(false);
  });

  it('setAnimationTargetBoomerang throws for ineligible target (no authored keys)', () => {
    const store = useProjectStore.getState();
    store.createAnimationClip({ animationId: 'a2', durationMs: 2000, fps: 30 });

    expect(() => {
      store.setAnimationTargetBoomerang({
        animationId: 'a2', targetId: 'n1', enabled: true,
      });
    }).toThrow('Cannot enable BOOMERANG for target');
  });
});
