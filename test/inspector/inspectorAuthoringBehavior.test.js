import { beforeEach, describe, expect, it } from 'vitest';
import {
  inspectorClearPoseTarget,
  inspectorCommit,
  inspectorPosePreview,
  inspectorPreview,
} from '@/features/animation';
import { useAnimationStore } from '@/store/animationStore';
import { useEditorStore } from '@/store/editorStore';
import { useProjectStore } from '@/store/projectStore';
import { clearHistory, undoCount } from '@/store/undoHistory';

function setup() {
  clearHistory();
  useProjectStore.getState().resetProject();
  useAnimationStore.getState().resetPlayback();
  useProjectStore.getState().updateProject((project) => {
    project.nodes.push({
      id: 'node-1',
      type: 'part',
      name: 'Head',
      parent: null,
      transform: {
        x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0,
      },
      opacity: 1,
      visible: true,
    });
  }, { skipHistory: true });
  useProjectStore.getState().createAnimationClip({
    animationId: 'anim-1',
    durationMs: 1000,
    fps: 24,
  });
  useAnimationStore.getState().switchAnimation(
    useProjectStore.getState().project.animations[0],
  );
  useEditorStore.setState({ editorMode: 'animation', autoKeyframe: false });
  clearHistory();
}

describe('inspector authoring behavior', () => {
  beforeEach(setup);

  it('keeps a manual edit in draft without project history', () => {
    inspectorPreview('node-1', 'x', 42);
    const result = inspectorCommit('inspector');

    expect(result.changed).toBe(false);
    expect(useAnimationStore.getState().draftDirty).toBe(true);
    expect(useProjectStore.getState().project.animations[0].tracks).toHaveLength(0);
    expect(undoCount()).toBe(0);
  });

  it('commits an auto-key edit as one history entry', () => {
    useEditorStore.setState({ autoKeyframe: true });
    inspectorPreview('node-1', 'x', 42);
    const result = inspectorCommit('inspector');

    expect(result.changed).toBe(true);
    expect(useAnimationStore.getState().draftDirty).toBe(false);
    const kf = useProjectStore.getState().project.animations[0].tracks[0].keyframes[0];
    expect(kf.time).toBe(0);
    expect(kf.value).toBe(42);
    expect(kf.easing).toBe('linear');
    expect(kf.authoring).toBeDefined();
    expect(kf.authoring.role).toBe('authored');
    expect(kf.authoring.source).toBe('inspector');
    expect(undoCount()).toBe(1);
  });

  it('authors and clears a staging pose without touching animation tracks', () => {
    useEditorStore.setState({ editorMode: 'staging' });

    expect(inspectorPosePreview('bone-1', 'rotation', 35)).toEqual({ valid: true });
    expect(useAnimationStore.getState().draftPose.get('bone-1')).toEqual({ rotation: 35 });

    inspectorClearPoseTarget('bone-1');
    expect(useAnimationStore.getState().draftPose.has('bone-1')).toBe(false);
    expect(useProjectStore.getState().project.animations[0].tracks).toHaveLength(0);
  });
});
