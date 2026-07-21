// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '../renderHook.jsx';
import { useAnimationStore } from '@/store/animationStore';
import { useEditorStore } from '@/store/editorStore';
import { useProjectStore } from '@/store/projectStore';

const authoringApi = vi.hoisted(() => ({ commit: vi.fn() }));

vi.mock('@/features/animation', () => ({
  createAnimationAuthoringApi: () => ({ commit: authoringApi.commit }),
}));

import { useEditorModeController } from '@/app/layout/hooks/useEditorModeController';

function resetStores() {
  useProjectStore.getState().resetProject();
  useProjectStore.getState().createAnimationClip({ animationId: 'anim-1', durationMs: 1000 });
  useEditorStore.setState({ editorMode: 'animation' });
  useAnimationStore.setState({
    activeAnimationId: 'anim-1',
    draftContext: { animationId: 'anim-1', timeMs: 100 },
    draftDirty: true,
    draftPose: new Map([['node-1', { x: 10 }]]),
    isPlaying: true,
    _lastTimestamp: 123,
  });
}

describe('useEditorModeController', () => {
  beforeEach(() => {
    resetStores();
    authoringApi.commit.mockReset();
  });

  it('exits when a no-write commit synchronously clears an externally reconciled draft', async () => {
    authoringApi.commit.mockImplementation(() => {
      useAnimationStore.getState().commitDraft();
      return { changed: false, affectedIds: [], committedAddresses: [] };
    });

    const { result } = renderHook(() => useEditorModeController());
    act(() => result.current.requestMode('staging'));
    expect(result.current.transitionState).not.toBeNull();

    await act(async () => {
      result.current.confirmCommit();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(useEditorStore.getState().editorMode).toBe('staging');
    expect(useAnimationStore.getState().isPlaying).toBe(false);
    expect(useAnimationStore.getState()._lastTimestamp).toBeNull();
  });
});
