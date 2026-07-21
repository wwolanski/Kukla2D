import { beforeEach, describe, expect, it } from 'vitest';
import { useAnimationStore } from '@/store/animationStore';
import { clearHistory } from '@/store/undoHistory';
import { useProjectStore } from '@/store/projectStore';
import { createTimelineCommandApi } from '@/features/timeline/application/createTimelineCommandApi';

function resetStores() {
  clearHistory();
  useAnimationStore.getState().resetPlayback();
  useProjectStore.getState().resetProject();
}

describe('createTimelineCommandApi', () => {
  beforeEach(() => {
    resetStores();
  });

  it('creates the first clip and syncs runtime selection', () => {
    const commands = createTimelineCommandApi();

    const createdId = commands.ensureAnimationClip();

    expect(createdId).toEqual(expect.any(String));
    expect(useProjectStore.getState().project.animations).toHaveLength(1);
    expect(useProjectStore.getState().project.animations[0].id).toBe(createdId);
    expect(useAnimationStore.getState().activeAnimationId).toBe(createdId);
    expect(useAnimationStore.getState().fps).toBe(24);
    expect(useAnimationStore.getState().endFrame).toBe(48);
  });

  it('syncs runtime timing when the active clip changes', () => {
    const commands = createTimelineCommandApi();

    commands.createAnimationClip({
      animationId: 'anim-1',
      durationMs: 1000,
      fps: 30,
      name: 'Walk',
    });

    expect(useAnimationStore.getState().activeAnimationId).toBe('anim-1');
    expect(useAnimationStore.getState().fps).toBe(30);
    expect(useAnimationStore.getState().endFrame).toBe(30);

    commands.updateAnimationTiming({
      animationId: 'anim-1',
      durationMs: 2000,
      fps: 24,
    });

    expect(useProjectStore.getState().project.animations[0]).toMatchObject({
      id: 'anim-1',
      duration: 2000,
      fps: 24,
    });
    expect(useAnimationStore.getState().fps).toBe(24);
    expect(useAnimationStore.getState().endFrame).toBe(48);
  });

  it('selects a remaining clip after deleting the active clip', () => {
    const commands = createTimelineCommandApi();

    commands.createAnimationClip({
      animationId: 'anim-1',
      durationMs: 1000,
      fps: 24,
    });
    commands.createAnimationClip({
      animationId: 'anim-2',
      durationMs: 1500,
      fps: 30,
    });

    commands.selectAnimationClip('anim-1');
    expect(useAnimationStore.getState().activeAnimationId).toBe('anim-1');

    commands.deleteAnimationClip('anim-1');

    expect(useProjectStore.getState().project.animations.map((animation) => animation.id)).toEqual(['anim-2']);
    expect(useAnimationStore.getState().activeAnimationId).toBe('anim-2');
    expect(useAnimationStore.getState().fps).toBe(30);
    expect(useAnimationStore.getState().endFrame).toBe(45);
  });

  it('keeps playback running when user selects another clip', () => {
    const commands = createTimelineCommandApi();
    commands.createAnimationClip({ animationId: 'anim-1', durationMs: 1000, fps: 24 });
    commands.createAnimationClip({ animationId: 'anim-2', durationMs: 1500, fps: 30 });
    commands.selectAnimationClip('anim-1');
    useAnimationStore.getState().play();

    commands.selectAnimationClip('anim-2');

    const state = useAnimationStore.getState();
    expect(state.activeAnimationId).toBe('anim-2');
    expect(state.isPlaying).toBe(true);
    expect(state.currentTime).toBe(0);
    expect(state._lastTimestamp).toBeNull();
  });

  it('keeps playback paused when user selects another clip while paused', () => {
    const commands = createTimelineCommandApi();
    commands.createAnimationClip({ animationId: 'anim-1', durationMs: 1000, fps: 24 });
    commands.createAnimationClip({ animationId: 'anim-2', durationMs: 1500, fps: 30 });
    commands.selectAnimationClip('anim-1');

    commands.selectAnimationClip('anim-2');

    expect(useAnimationStore.getState().activeAnimationId).toBe('anim-2');
    expect(useAnimationStore.getState().isPlaying).toBe(false);
  });
});
