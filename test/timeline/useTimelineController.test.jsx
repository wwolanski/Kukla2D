// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '../renderHook.jsx';
import { useTimelineController } from '@/features/timeline/application/useTimelineController';
import { useAnimationStore } from '@/store/animationStore';
import { useProjectStore } from '@/store/projectStore';
import { clearHistory } from '@/store/undoHistory';

function resetStores() {
  clearHistory();
  useAnimationStore.getState().resetPlayback();
  useProjectStore.getState().resetProject();
}

describe('useTimelineController', () => {
  beforeEach(() => {
    resetStores();
  });

  it('returns idle state when no animations exist', () => {
    const { result } = renderHook(() => useTimelineController());

    expect(result.current.activeClip).toBeNull();
    expect(result.current.trackRows).toEqual([]);
    expect(result.current.hasAnimation).toBe(false);
    expect(result.current.animations).toHaveLength(0);
    expect(result.current.fps).toBe(24);
  });

  it('returns active clip after one is created and selected', () => {
    const { result } = renderHook(() => useTimelineController());

    act(() => {
      result.current.createClip({
        animationId: 'anim-1',
        name: 'Walk',
        durationMs: 1000,
        fps: 30,
      });
    });

    expect(result.current.activeClip).not.toBeNull();
    expect(result.current.activeClip.id).toBe('anim-1');
    expect(result.current.activeClip.name).toBe('Walk');
    expect(result.current.hasAnimation).toBe(true);
    expect(result.current.fps).toBe(30);
  });

  it('computes timing snapshot from active clip', () => {
    const { result } = renderHook(() => useTimelineController());

    act(() => {
      result.current.createClip({
        animationId: 'anim-1',
        durationMs: 1000,
        fps: 30,
      });
    });

    expect(result.current.startFrame).toBe(0);
    expect(result.current.endFrame).toBe(30);
    expect(result.current.totalFrames).toBe(30);
    expect(result.current.currentFrame).toBe(0);
  });

  it('does not re-render for rAF time changes inside the same animation frame', () => {
    let renderCount = 0;
    renderHook(() => {
      renderCount += 1;
      return useTimelineController();
    });
    const initialRenderCount = renderCount;

    act(() => {
      useAnimationStore.setState({ fps: 10, currentTime: 10 });
    });
    const frameZeroRenderCount = renderCount;

    act(() => {
      useAnimationStore.setState({ currentTime: 20 });
    });
    expect(renderCount).toBe(frameZeroRenderCount);

    act(() => {
      useAnimationStore.setState({ currentTime: 100 });
    });
    expect(frameZeroRenderCount).toBeGreaterThan(initialRenderCount);
    expect(renderCount).toBeGreaterThan(frameZeroRenderCount);
  });

  it('builds track rows from active clip tracks', () => {
    const { result } = renderHook(() => useTimelineController());

    act(() => {
      result.current.createClip({
        animationId: 'anim-1',
        name: 'Test',
        durationMs: 1000,
        fps: 24,
      });
    });

    act(() => {
      result.current.upsertKeyframe({
        animationId: 'anim-1',
        targetId: 'node-1',
        property: 'x',
        timeMs: 0,
        value: 10,
      });
    });

    expect(result.current.trackRows).toHaveLength(1);
    expect(result.current.trackRows[0].targetId).toBe('node-1');
  });

  it('stable commands reference across re-renders', () => {
    const { result } = renderHook(() => useTimelineController());
    const firstCommands = result.current.commands;

    expect(result.current.commands).toBe(firstCommands);
  });

  it('stable intent callbacks across re-renders with same deps', () => {
    const { result } = renderHook(() => useTimelineController());
    const firstCreateClip = result.current.createClip;
    const firstDeleteClip = result.current.deleteClip;
    const firstAddMarker = result.current.addMarker;

    expect(result.current.createClip).toBe(firstCreateClip);
    expect(result.current.deleteClip).toBe(firstDeleteClip);
    expect(result.current.addMarker).toBe(firstAddMarker);
  });

  it('delegates createClip through named intent', () => {
    const { result } = renderHook(() => useTimelineController());

    act(() => {
      result.current.createClip({
        animationId: 'anim-1',
        name: 'Run',
        durationMs: 500,
        fps: 24,
      });
    });

    expect(useProjectStore.getState().project.animations).toHaveLength(1);
    expect(useProjectStore.getState().project.animations[0].name).toBe('Run');
    expect(useAnimationStore.getState().activeAnimationId).toBe('anim-1');
  });

  it('delegates deleteClip through named intent', () => {
    const { result } = renderHook(() => useTimelineController());

    act(() => {
      result.current.createClip({
        animationId: 'anim-1',
        name: 'A',
        durationMs: 500,
        fps: 24,
      });
    });
    act(() => {
      result.current.createClip({
        animationId: 'anim-2',
        name: 'B',
        durationMs: 500,
        fps: 24,
      });
    });

    act(() => {
      result.current.deleteClip('anim-1');
    });

    expect(useProjectStore.getState().project.animations.map((a) => a.id)).toEqual(['anim-2']);
    expect(useAnimationStore.getState().activeAnimationId).toBe('anim-2');
  });

  it('delegates selectClip through named intent', () => {
    const { result } = renderHook(() => useTimelineController());

    act(() => {
      result.current.createClip({
        animationId: 'anim-1',
        name: 'A',
        durationMs: 500,
        fps: 24,
      });
    });
    act(() => {
      result.current.createClip({
        animationId: 'anim-2',
        name: 'B',
        durationMs: 500,
        fps: 30,
      });
    });

    act(() => {
      result.current.selectClip('anim-1');
    });

    expect(useAnimationStore.getState().activeAnimationId).toBe('anim-1');
    expect(result.current.fps).toBe(24);
  });

  it('delegates addMarker through named intent', () => {
    const { result } = renderHook(() => useTimelineController());

    act(() => {
      result.current.createClip({
        animationId: 'anim-1',
        name: 'A',
        durationMs: 1000,
        fps: 24,
      });
    });

    act(() => {
      result.current.addMarker({
        animationId: 'anim-1',
        timeMs: 500,
        label: 'Beat',
      });
    });

    const clip = useProjectStore.getState().project.animations[0];
    expect(clip.markers).toHaveLength(1);
    expect(clip.markers[0].label).toBe('Beat');
    expect(clip.markers[0].time).toBe(500);
  });

  it('delegates updateTiming through named intent', () => {
    const { result } = renderHook(() => useTimelineController());

    act(() => {
      result.current.createClip({
        animationId: 'anim-1',
        name: 'A',
        durationMs: 1000,
        fps: 24,
      });
    });

    act(() => {
      result.current.updateTiming({
        animationId: 'anim-1',
        durationMs: 2000,
        fps: 60,
      });
    });

    expect(useProjectStore.getState().project.animations[0].duration).toBe(2000);
    expect(useProjectStore.getState().project.animations[0].fps).toBe(60);
    expect(useAnimationStore.getState().fps).toBe(60);
  });

  it('returns targetDescriptors built from project nodes/bones/constraints', () => {
    useProjectStore.getState().updateProject((draftProject) => {
      draftProject.nodes.push({ id: 'n1', type: 'part', name: 'Head', parent: null, transform: {}, visible: true, opacity: 1 });
      draftProject.bones.push({ id: 'b1', name: 'Spine', parent: null, length: 50, transform: {} });
      draftProject.constraints.push({ id: 'c1', name: 'LeftArm', type: 'ik' });
    });

    const { result } = renderHook(() => useTimelineController());

    expect(result.current.targetDescriptors).toEqual([
      { id: 'n1', name: 'Head', kind: 'node' },
      { id: 'b1', name: '\u{1f9b4} Spine', kind: 'bone' },
      { id: 'c1', name: 'IK LeftArm', kind: 'constraint' },
    ]);
  });

  it('ensureAnimation creates clip when none exist', () => {
    const { result } = renderHook(() => useTimelineController());

    let createdId;
    act(() => {
      createdId = result.current.ensureAnimation();
    });

    expect(createdId).toEqual(expect.any(String));
    expect(useAnimationStore.getState().activeAnimationId).toBe(createdId);
    expect(result.current.hasAnimation).toBe(true);
  });
});
