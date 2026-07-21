// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '../renderHook.jsx';
import { useKeyframeSelection } from '@/features/timeline/application/useKeyframeSelection.js';

describe('keyframe boundary', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function createSelectionProps(overrides = {}) {
    const rulerRef = {
      current: {
        getBoundingClientRect: () => ({ left: 0, width: 200 }),
      },
    };
    const trackAreaRef = {
      current: {
        scrollLeft: 0,
        scrollTop: 0,
        getBoundingClientRect: () => ({ left: 0, top: 0 }),
      },
    };

    return {
      rulerRef,
      trackAreaRef,
      animation: {
        duration: 2000,
        tracks: [
          { targetId: 'node-1', property: 'x', keyframes: [{ time: 100, value: 1 }] },
          { targetId: 'node-1', property: 'y', keyframes: [{ time: 100, value: 2 }] },
        ],
      },
      xToFrame: (clientX) => clientX,
      startFrame: 0,
      endFrame: 24,
      totalFrames: 24,
      fps: 10,
      activeAnimationId: 'anim-1',
      seekFrame: vi.fn(),
      moveKeyframes: vi.fn(),
      ...overrides,
    };
  }

  it('selects canonical addresses for two properties at same time', () => {
    const props = createSelectionProps();
    const { result } = renderHook(() => useKeyframeSelection(props));

    act(() => {
      result.current.onKeyframePointerDown({
        stopPropagation() {},
        shiftKey: false,
        clientX: 10,
      }, 'node-1', 100);
    });

    expect(Array.from(result.current.selectedKeyframes).sort()).toEqual([
      'node-1:x:100',
      'node-1:y:100',
    ]);

    act(() => {
      window.dispatchEvent(new MouseEvent('pointerup'));
    });
  });

  it('commits multi-keyframe drag once with canonical refs and clamp-to-zero', () => {
    const props = createSelectionProps();
    const { result } = renderHook(() => useKeyframeSelection(props));

    act(() => {
      result.current.onKeyframePointerDown({
        stopPropagation() {},
        shiftKey: false,
        clientX: 1,
      }, 'node-1', 100);
    });

    act(() => {
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: -50 }));
      window.dispatchEvent(new MouseEvent('pointerup'));
    });

    expect(props.moveKeyframes).toHaveBeenCalledTimes(1);
    expect(props.moveKeyframes).toHaveBeenCalledWith({
      animationId: 'anim-1',
      keyframes: [
        { targetId: 'node-1', property: 'x', timeMs: 100 },
        { targetId: 'node-1', property: 'y', timeMs: 100 },
      ],
      deltaMs: -100,
    });
    expect(Array.from(result.current.selectedKeyframes).sort()).toEqual([
      'node-1:x:0',
      'node-1:y:0',
    ]);
  });

  it('creates valid keyframePreview during drag', () => {
    const props = createSelectionProps();
    const { result } = renderHook(() => useKeyframeSelection(props));

    act(() => {
      result.current.onKeyframePointerDown({
        stopPropagation() {},
        shiftKey: false,
        clientX: 1,
      }, 'node-1', 100);
    });

    expect(result.current.keyframePreview).toBeNull();

    act(() => {
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: 50 }));
    });

    expect(result.current.keyframePreview).not.toBeNull();
    expect(result.current.keyframePreview.active).toBe(true);
    expect(result.current.keyframePreview.valid).toBe(true);
    expect(result.current.keyframePreview.deltaMs).toBeGreaterThan(0);

    act(() => {
      window.dispatchEvent(new MouseEvent('pointerup'));
    });

    expect(result.current.keyframePreview).toBeNull();
  });

  it('does not call moveKeyframes on pointer-up when preview is invalid due to boomerang lock', () => {
    const props = createSelectionProps({
      animation: {
        duration: 2000,
        boomerangTargets: {
          'node-1': { sourceEndMs: 100 },
        },
        tracks: [
          { targetId: 'node-1', property: 'x', keyframes: [{ time: 0, value: 10 }, { time: 50, value: 20 }] },
        ],
      },
      fps: 30,
      startFrame: 0,
      endFrame: 60,
      totalFrames: 60,
    });
    const { result } = renderHook(() => useKeyframeSelection(props));

    act(() => {
      result.current.onKeyframePointerDown({
        stopPropagation() {},
        shiftKey: false,
        clientX: 0,
      }, 'node-1', 50);
    });

    act(() => {
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: 5 }));
    });

    expect(result.current.keyframePreview).not.toBeNull();
    expect(result.current.keyframePreview.valid).toBe(false);
    expect(result.current.keyframePreview.reasonCode).toBe('boomerang_generated_range');

    act(() => {
      window.dispatchEvent(new MouseEvent('pointerup'));
    });

    expect(props.moveKeyframes).not.toHaveBeenCalled();
    expect(result.current.keyframePreview).toBeNull();
  });

  it('clears keyframePreview on pointer-up even when preview is valid', () => {
    const props = createSelectionProps();
    const { result } = renderHook(() => useKeyframeSelection(props));

    act(() => {
      result.current.onKeyframePointerDown({
        stopPropagation() {},
        shiftKey: false,
        clientX: 1,
      }, 'node-1', 100);
    });

    act(() => {
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: 50 }));
    });

    expect(result.current.keyframePreview).not.toBeNull();

    act(() => {
      window.dispatchEvent(new MouseEvent('pointerup'));
    });

    expect(result.current.keyframePreview).toBeNull();
    expect(props.moveKeyframes).toHaveBeenCalledTimes(1);
  });
});
