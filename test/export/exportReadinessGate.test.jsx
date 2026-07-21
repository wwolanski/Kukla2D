// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resolveExportReadinessTarget,
  useExportReadinessGate,
} from '@/features/export/application/useExportReadinessGate.js';
import { act, renderHook } from '../renderHook.jsx';

const readinessMock = vi.hoisted(() => ({
  analyzeProjectReadiness: vi.fn(),
}));

vi.mock('@/domain/projectReadiness.js', () => readinessMock);

function mountGate({ type = 'frames', setExportError = vi.fn() } = {}) {
  return {
    setExportError,
    hook: renderHook(() => useExportReadinessGate({
      project: { id: 'project' },
      type,
      setExportError,
    })),
  };
}

describe('export readiness gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readinessMock.analyzeProjectReadiness.mockReturnValue({ errors: [], warnings: [] });
  });

  it('maps export types to readiness targets', () => {
    expect(resolveExportReadinessTarget('frames')).toBe('frames');
    expect(resolveExportReadinessTarget('spine')).toBe('frames');
    expect(resolveExportReadinessTarget('live2d')).toBe('frames');
    expect(resolveExportReadinessTarget('live2d_project')).toBe('frames');
    expect(resolveExportReadinessTarget('phaser_atlas')).toBe('phaser_atlas');
  });

  it('blocks errors before executor side effects', () => {
    readinessMock.analyzeProjectReadiness.mockReturnValue({
      errors: [{ code: 'ASSET_SOURCE_MISSING', path: 'textures[0].source', message: 'missing' }],
      warnings: [],
    });
    const executor = vi.fn();
    const { hook, setExportError } = mountGate();

    act(() => {
      hook.result.current.runWithGate(executor);
    });

    expect(readinessMock.analyzeProjectReadiness).toHaveBeenCalledOnce();
    expect(executor).not.toHaveBeenCalled();
    expect(setExportError).toHaveBeenLastCalledWith('[ASSET_SOURCE_MISSING] textures[0].source: missing');
    expect(hook.result.current.decision.kind).toBe('blocked');
  });

  it('requires Continue for warnings and Cancel keeps zero side effects', () => {
    readinessMock.analyzeProjectReadiness.mockReturnValue({
      errors: [],
      warnings: [{ code: 'DANGLING_TARGET', path: '$', message: 'BRAK DANYCH' }],
    });
    const setIsExporting = vi.fn();
    const executor = vi.fn(() => setIsExporting(true));
    const { hook } = mountGate({ type: 'spine' });

    act(() => {
      hook.result.current.runWithGate(executor);
    });

    expect(readinessMock.analyzeProjectReadiness).toHaveBeenCalledOnce();
    expect(executor).not.toHaveBeenCalled();
    expect(setIsExporting).not.toHaveBeenCalled();
    expect(hook.result.current.decision.kind).toBe('confirm');

    act(() => {
      hook.result.current.cancelPending();
    });

    expect(executor).not.toHaveBeenCalled();
    expect(hook.result.current.decision).toBeNull();
  });

  it('Continue executes pending action exactly once and does not re-run readiness', async () => {
    readinessMock.analyzeProjectReadiness.mockReturnValue({
      errors: [],
      warnings: [{ code: 'DANGLING_TARGET', path: '$', message: 'BRAK DANYCH' }],
    });
    const executor = vi.fn().mockResolvedValue('done');
    const { hook } = mountGate({ type: 'live2d' });

    act(() => {
      hook.result.current.runWithGate(executor);
    });
    await act(async () => {
      await hook.result.current.continuePending();
      await hook.result.current.continuePending();
    });

    expect(executor).toHaveBeenCalledOnce();
    expect(executor).toHaveBeenCalledWith(expect.objectContaining({ warnings: expect.any(Array) }));
    expect(readinessMock.analyzeProjectReadiness).toHaveBeenCalledOnce();
    expect(hook.result.current.decision).toBeNull();
  });

  it('runs clean readiness immediately without dialog', () => {
    const executor = vi.fn();
    const { hook } = mountGate({ type: 'live2d_project' });

    act(() => {
      hook.result.current.runWithGate(executor);
    });

    expect(executor).toHaveBeenCalledOnce();
    expect(executor).toHaveBeenCalledWith({ errors: [], warnings: [] });
    expect(hook.result.current.decision).toBeNull();
  });
});
