// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useProjectSession } from '@/features/projects';
import { act, renderHook } from '../renderHook.jsx';

const storeMocks = vi.hoisted(() => ({
  startEditor: vi.fn(),
  setActiveLayerTab: vi.fn(),
  nodes: [],
  author: '',
  saveToDb: vi.fn(),
}));

vi.mock('@/store/editorStore', () => ({
  useEditorStore: selector => selector({
    startEditor: storeMocks.startEditor,
    setActiveLayerTab: storeMocks.setActiveLayerTab,
  }),
}));

vi.mock('@/store/projectStore', () => {
  const state = () => ({ project: { nodes: storeMocks.nodes, author: storeMocks.author } });
  const useProjectStore = selector => selector(state());
  useProjectStore.getState = state;
  return { useProjectStore };
});

vi.mock('@/io/projectDb', () => ({
  saveToDb: storeMocks.saveToDb,
}));

describe('useProjectSession', () => {
  beforeEach(() => {
    storeMocks.startEditor.mockReset();
    storeMocks.setActiveLayerTab.mockReset();
    storeMocks.saveToDb.mockReset();
  });

  it('starts a new empty project through the imperative reset boundary', () => {
    const reset = vi.fn();
    const { result } = renderHook(() => useProjectSession({
      loadRef: { current: vi.fn() },
      resetRef: { current: reset },
      thumbCaptureRef: { current: vi.fn() },
    }));

    act(() => {
      result.current.handleNewProject();
    });

    expect(reset).toHaveBeenCalledOnce();
    expect(storeMocks.startEditor).toHaveBeenCalledOnce();
    expect(result.current.currentDbProjectId).toBeNull();
    expect(result.current.currentDbProjectName).toBeNull();
  });

  it('handleLoadRecord awaits load before startEditor and sets metadata', async () => {
    storeMocks.startEditor.mockClear();
    const loadOrder = [];
    const loadFn = vi.fn(async () => {
      loadOrder.push('load');
      return { success: true };
    });
    loadFn.mockImplementation(async () => {
      loadOrder.push('load');
      return { success: true };
    });

    const { result } = renderHook(() => useProjectSession({
      loadRef: { current: loadFn },
      resetRef: { current: vi.fn() },
      thumbCaptureRef: { current: vi.fn() },
    }));

    await act(async () => {
      await result.current.handleLoadRecord({ id: 'abc', name: 'Test', blob: new Blob() });
    });

    expect(loadFn).toHaveBeenCalledOnce();
    expect(loadFn.mock.calls[0][0].name).toBe('Test.kk2d');
    expect(loadOrder).toEqual(['load']);
    expect(storeMocks.startEditor).toHaveBeenCalledAfter(loadFn);
    expect(result.current.currentDbProjectId).toBe('abc');
    expect(result.current.currentDbProjectName).toBe('Test');
  });

  it('handleLoadRecord does not call startEditor on load failure', async () => {
    storeMocks.startEditor.mockClear();
    const loadFn = vi.fn(async () => ({ success: false, error: new Error('bad file') }));

    const { result } = renderHook(() => useProjectSession({
      loadRef: { current: loadFn },
      resetRef: { current: vi.fn() },
      thumbCaptureRef: { current: vi.fn() },
    }));

    await act(async () => {
      await result.current.handleLoadRecord({ id: 'abc', name: 'Test', blob: new Blob() });
    });

    expect(loadFn).toHaveBeenCalledOnce();
    expect(storeMocks.startEditor).not.toHaveBeenCalled();
    expect(result.current.currentDbProjectId).toBeNull();
  });

  it('loads example project and opens the Bones tab', async () => {
    const loadFn = vi.fn(async () => ({ success: true }));
    const { result } = renderHook(() => useProjectSession({
      loadRef: { current: loadFn },
      resetRef: { current: vi.fn() },
      thumbCaptureRef: { current: vi.fn() },
    }));

    await act(async () => {
      result.current.handleLoadExampleProject(
        new File(['x'], 'example-project.kk2d', { type: 'application/zip' }),
      );
      await Promise.resolve();
    });

    expect(loadFn).toHaveBeenCalledOnce();
    expect(storeMocks.setActiveLayerTab).toHaveBeenCalledWith('groups');
  });

  it('finalizeLoadFile strips .kk2d and stores with archive metadata', async () => {
    storeMocks.startEditor.mockClear();
    storeMocks.saveToDb.mockResolvedValue('saved-1');
    const loadFn = vi.fn(async () => ({ success: true }));
    const thumbCapture = vi.fn(() => 'thumb-data');

    const { result } = renderHook(() => useProjectSession({
      loadRef: { current: loadFn },
      resetRef: { current: vi.fn() },
      thumbCaptureRef: { current: thumbCapture },
    }));

    await act(async () => {
      await result.current.finalizeLoadFile(new File(['x'], 'Library Project.kk2d', { type: 'application/zip' }), true);
    });

    expect(loadFn).toHaveBeenCalledOnce();
    expect(loadFn.mock.calls[0][0].name).toBe('Library Project.kk2d');
    expect(storeMocks.saveToDb).toHaveBeenCalledWith(
      null,
      'Library Project',
      expect.any(Blob),
      'thumb-data',
      expect.objectContaining({
        formatId: 'kukla2d.dev/project',
        formatVersion: 1,
        extension: 'kk2d',
      }),
    );
    expect(result.current.currentDbProjectId).toBe('saved-1');
    expect(result.current.currentDbProjectName).toBe('Library Project');
  });

  it('finalizeLoadFile strips legacy names before storing', async () => {
    storeMocks.startEditor.mockClear();
    storeMocks.saveToDb.mockResolvedValue('saved-2');
    const loadFn = vi.fn(async () => ({ success: true }));

    const { result } = renderHook(() => useProjectSession({
      loadRef: { current: loadFn },
      resetRef: { current: vi.fn() },
      thumbCaptureRef: { current: vi.fn(() => '') },
    }));

    await act(async () => {
      await result.current.finalizeLoadFile(new File(['x'], 'Legacy Project.kk2d', { type: 'application/zip' }), true);
    });

    expect(storeMocks.saveToDb).toHaveBeenCalledWith(
      null,
      'Legacy Project',
      expect.any(Blob),
      '',
      expect.objectContaining({
        formatId: 'kukla2d.dev/project',
        formatVersion: 1,
        extension: 'kk2d',
      }),
    );
    expect(result.current.currentDbProjectId).toBe('saved-2');
    expect(result.current.currentDbProjectName).toBe('Legacy Project');
  });
});
