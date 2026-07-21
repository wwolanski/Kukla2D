import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAnimationStore } from '@/store/animationStore';
import { clearHistory } from '@/store/undoHistory';
import { useProjectStore } from '@/store/projectStore';
import { createTimelineCommandApi } from '@/features/timeline/application/createTimelineCommandApi';

vi.mock('@/platform/animationSettingsRepository', () => ({
  loadAnimationSettings: vi.fn(() => ({ frameCount: 60, fps: 30, speed: 1.25 })),
}));

function resetStores() {
  clearHistory();
  useAnimationStore.getState().resetPlayback();
  useProjectStore.getState().resetProject();
}

describe('A8: settings → new clip integration', () => {
  beforeEach(() => {
    resetStores();
  });

  it('new clip from ensureAnimationClip picks up settings (fps=30, endFrame=60)', () => {
    const commands = createTimelineCommandApi();
    const id = commands.ensureAnimationClip();

    expect(id).toEqual(expect.any(String));
    const anim = useProjectStore.getState().project.animations[0];
    expect(anim.fps).toBe(30);
    expect(anim.duration).toBe(2000);
    expect(useAnimationStore.getState().fps).toBe(30);
    expect(useAnimationStore.getState().endFrame).toBe(60);
  });

  it('new clip from createAnimationClip without explicit payload picks up settings', () => {
    const commands = createTimelineCommandApi();
    commands.createAnimationClip({ animationId: 'a1' });

    const anim = useProjectStore.getState().project.animations[0];
    expect(anim.fps).toBe(30);
    expect(anim.duration).toBe(2000);
    expect(useAnimationStore.getState().fps).toBe(30);
  });

  it('explicit payload overrides settings', () => {
    const commands = createTimelineCommandApi();
    commands.createAnimationClip({ animationId: 'a1', fps: 12, durationMs: 500 });

    const anim = useProjectStore.getState().project.animations[0];
    expect(anim.fps).toBe(12);
    expect(anim.duration).toBe(500);
    expect(useAnimationStore.getState().fps).toBe(12);
  });

  it('existing clip timing unchanged after settings change', () => {
    const commands = createTimelineCommandApi();
    commands.createAnimationClip({ animationId: 'a1', fps: 24, durationMs: 1000 });

    const beforeAnim = useProjectStore.getState().project.animations[0];
    expect(beforeAnim.fps).toBe(24);
    expect(beforeAnim.duration).toBe(1000);

    commands.createAnimationClip({ animationId: 'a2' });

    const afterAnim = useProjectStore.getState().project.animations[0];
    expect(afterAnim.fps).toBe(24);
    expect(afterAnim.duration).toBe(1000);

    const newAnim = useProjectStore.getState().project.animations[1];
    expect(newAnim.fps).toBe(30);
    expect(newAnim.duration).toBe(2000);
  });
});
