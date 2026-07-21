// @vitest-environment jsdom
/* eslint-disable react/prop-types */
import { useCallback } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useExportAreaMoveSession } from '@/features/canvas/application/useExportAreaMoveSession.js';
import { useAnimationStore } from '@/store/animationStore';
import { useProjectStore } from '@/store/projectStore';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function Harness({ active = true, activeTool = 'select', editorMode = 'staging', onFinish }) {
  const finish = useCallback(() => onFinish(), [onFinish]);
  useExportAreaMoveSession({ active, activeTool, editorMode, finish });
  return null;
}

describe('useExportAreaMoveSession', () => {
  let container;
  let root;
  let originalAnimations;
  let originalCurrentTime;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    originalAnimations = useProjectStore.getState().project.animations;
    originalCurrentTime = useAnimationStore.getState().currentTime;
  });

  afterEach(() => {
    act(() => root.unmount());
    useProjectStore.setState(state => ({
      project: { ...state.project, animations: originalAnimations },
    }));
    useAnimationStore.setState({ currentTime: originalCurrentTime });
    container.remove();
  });

  it('finishes when another editor tool becomes active', () => {
    const finish = vi.fn();
    act(() => root.render(<Harness activeTool="select" onFinish={finish} />));
    act(() => root.render(<Harness activeTool="pose" onFinish={finish} />));
    expect(finish).toHaveBeenCalledOnce();
  });

  it('finishes on any animation-session change', () => {
    const finish = vi.fn();
    act(() => root.render(<Harness onFinish={finish} />));
    act(() => useAnimationStore.setState(state => ({ currentTime: state.currentTime + 1 })));
    expect(finish).toHaveBeenCalledOnce();
  });

  it('finishes when animation document data changes', () => {
    const finish = vi.fn();
    act(() => root.render(<Harness onFinish={finish} />));
    act(() => useProjectStore.setState(state => ({
      project: { ...state.project, animations: [...state.project.animations] },
    })));
    expect(finish).toHaveBeenCalledOnce();
  });

  it('ignores animation changes after session deactivation', () => {
    const finish = vi.fn();
    act(() => root.render(<Harness active={false} onFinish={finish} />));
    act(() => useAnimationStore.setState(state => ({ currentTime: state.currentTime + 1 })));
    expect(finish).not.toHaveBeenCalled();
  });
});
