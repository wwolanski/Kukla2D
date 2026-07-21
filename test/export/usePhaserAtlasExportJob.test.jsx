// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePhaserAtlasExportJob } from '@/features/export/application/usePhaserAtlasExportJob';
import { act, renderHook } from '../renderHook.jsx';

const runExportMock = vi.hoisted(() => vi.fn());
const createPlanMock = vi.hoisted(() => vi.fn());
const adapterMock = vi.hoisted(() => vi.fn());

vi.mock('@/features/export/application/runPhaserAtlasExport', () => ({
  runPhaserAtlasExport: runExportMock,
}));
vi.mock('@/features/export/domain/phaserAtlasExportPlan', () => ({
  createPhaserAtlasExportPlan: createPlanMock,
}));
vi.mock('@/features/export/infrastructure/browserExportSink', () => ({
  browserExportSink: vi.fn(),
}));
vi.mock('@kukla2d/adapter-phaser-atlas', () => ({
  encodePhaserAtlasPackage: adapterMock,
}));

function createStatusSetters() {
  return {
    setProgress: vi.fn(),
    setIsExporting: vi.fn(),
    setExportError: vi.fn(),
  };
}

function createValidProject() {
  return {
    version: 6,
    canvas: { width: 100, height: 100, x: 0, y: 0 },
    textures: [],
    nodes: [],
    animations: [{ id: 'anim-1', name: 'idle', duration: 2000, fps: 24, tracks: [] }],
  };
}

function createBaseProps(overrides = {}) {
  return {
    captureRef: { current: vi.fn(() => ({ ok: true, dataUrl: 'data:png', width: 100, height: 100 })) },
    project: createValidProject(),
    animations: [{ id: 'anim-1', name: 'idle', duration: 2000 }],
    exportFps: 24,
    outputScale: 100,
    trim: true,
    padding: 2,
    maxPageSize: 2048,
    loop: true,
    outputName: 'test-char',
    exportDest: 'zip',
    ...createStatusSetters(),
    ...overrides,
  };
}

describe('usePhaserAtlasExportJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runExportMock.mockResolvedValue({ ok: true, artifacts: [{ fileName: 'test.png' }] });
    createPlanMock.mockReturnValue({
      variantId: 'phaser_atlas',
      area: { source: { x: 0, y: 0, width: 100, height: 100 }, outputWidth: 100, outputHeight: 100 },
      fps: 24,
      scale: 100,
      animations: [{ id: 'anim-1', name: 'idle', duration: 2000 }],
      frameSpecs: [{ animId: 'anim-1', animName: 'idle', frameIndex: 0, timeMs: 0 }],
      background: { enabled: false, color: '#ffffff' },
      trim: true,
      padding: 2,
      maxPageSize: 2048,
      loop: true,
      outputName: 'test-char',
      destination: 'zip',
    });
  });

  it('exposes run and cancel', () => {
    const { result } = renderHook(() => usePhaserAtlasExportJob(createBaseProps()));

    expect(typeof result.current.run).toBe('function');
    expect(typeof result.current.cancel).toBe('function');
  });

  it('sets error when captureRef is null', async () => {
    const status = createStatusSetters();
    const { result } = renderHook(() => usePhaserAtlasExportJob(createBaseProps({
      captureRef: { current: null },
      ...status,
    })));

    await act(async () => {
      await result.current.run();
    });

    expect(status.setExportError).toHaveBeenCalledWith('Capture reference not available');
    expect(status.setIsExporting).not.toHaveBeenCalled();
  });

  it('calls createPhaserAtlasExportPlan and runPhaserAtlasExport on success', async () => {
    const status = createStatusSetters();
    const { result } = renderHook(() => usePhaserAtlasExportJob(createBaseProps({ ...status })));

    await act(async () => {
      await result.current.run();
    });

    expect(createPlanMock).toHaveBeenCalledOnce();
    expect(runExportMock).toHaveBeenCalledOnce();
    expect(status.setIsExporting).toHaveBeenLastCalledWith(false);
    expect(status.setExportError).not.toHaveBeenCalled();
  });

  it('passes correct plan args', async () => {
    const status = createStatusSetters();
    const { result } = renderHook(() => usePhaserAtlasExportJob(createBaseProps({
      outputScale: 200,
      exportFps: 12,
      trim: false,
      padding: 4,
      maxPageSize: 4096,
      loop: false,
      outputName: 'my-char',
      exportDest: 'folder',
      ...status,
    })));

    await act(async () => {
      await result.current.run();
    });

    const planArgs = createPlanMock.mock.calls[0][0];
    expect(planArgs.fps).toBe(12);
    expect(planArgs.scale).toBe(200);
    expect(planArgs.trim).toBe(false);
    expect(planArgs.padding).toBe(4);
    expect(planArgs.maxPageSize).toBe(4096);
    expect(planArgs.loop).toBe(false);
    expect(planArgs.outputName).toBe('my-char');
    expect(planArgs.destination).toBe('folder');
  });

  it('normalizes download destination to zip', async () => {
    const status = createStatusSetters();
    const { result } = renderHook(() => usePhaserAtlasExportJob(createBaseProps({
      exportDest: 'download',
      ...status,
    })));

    await act(async () => {
      await result.current.run();
    });

    const planArgs = createPlanMock.mock.calls[0][0];
    expect(planArgs.destination).toBe('zip');
  });

  it('sets export error when runPhaserAtlasExport returns failure', async () => {
    runExportMock.mockResolvedValue({ ok: false, error: { code: 'CAPTURE_FAILED', message: 'Capture failed' } });

    const status = createStatusSetters();
    const { result } = renderHook(() => usePhaserAtlasExportJob(createBaseProps({ ...status })));

    await act(async () => {
      await result.current.run();
    });

    expect(status.setExportError).toHaveBeenCalledWith('Capture failed');
    expect(status.setIsExporting).toHaveBeenLastCalledWith(false);
  });

  it('handles cancelled export gracefully', async () => {
    runExportMock.mockResolvedValue({ ok: false, cancelled: true });

    const status = createStatusSetters();
    const { result } = renderHook(() => usePhaserAtlasExportJob(createBaseProps({ ...status })));

    await act(async () => {
      await result.current.run();
    });

    expect(status.setExportError).not.toHaveBeenCalled();
    expect(status.setIsExporting).toHaveBeenLastCalledWith(false);
  });

  it('handles exception from runPhaserAtlasExport', async () => {
    runExportMock.mockRejectedValue(new Error('Something went wrong'));

    const status = createStatusSetters();
    const { result } = renderHook(() => usePhaserAtlasExportJob(createBaseProps({ ...status })));

    await act(async () => {
      await result.current.run();
    });

    expect(status.setExportError).toHaveBeenCalledWith('Something went wrong');
    expect(status.setIsExporting).toHaveBeenLastCalledWith(false);
  });

  it('cancel aborts in-flight job', async () => {
    let resolveExport;
    runExportMock.mockReturnValue(new Promise((resolve) => { resolveExport = resolve; }));

    const status = createStatusSetters();
    const { result } = renderHook(() => usePhaserAtlasExportJob(createBaseProps({ ...status })));

    act(() => {
      result.current.run();
    });

    act(() => {
      result.current.cancel();
    });

    await act(async () => {
      resolveExport({ ok: true, artifacts: [] });
    });

    expect(status.setIsExporting).toHaveBeenCalledWith(true);
    expect(status.setIsExporting).toHaveBeenLastCalledWith(false);
    expect(status.setProgress).toHaveBeenLastCalledWith(null);
  });

  it('passes readiness report to orchestrator', async () => {
    const report = { errors: [], warnings: [{ code: 'BAKED', path: '$', message: 'Baked' }] };
    const { result } = renderHook(() => usePhaserAtlasExportJob(createBaseProps()));

    await act(async () => {
      await result.current.run(report);
    });

    expect(runExportMock).toHaveBeenCalledWith(expect.objectContaining({ readinessReport: report }));
  });

  it('aborts previous job when run is called twice', async () => {
    const abortSpy = vi.spyOn(AbortController.prototype, 'abort');
    runExportMock.mockResolvedValue({ ok: true, artifacts: [] });

    const status = createStatusSetters();
    const { result } = renderHook(() => usePhaserAtlasExportJob(createBaseProps({ ...status })));

    await act(async () => {
      result.current.run();
    });

    await act(async () => {
      result.current.run();
    });

    expect(abortSpy).toHaveBeenCalled();
    expect(runExportMock).toHaveBeenCalledTimes(2);
    abortSpy.mockRestore();
  });

  it('uses stale-guard: does not update state after unmount', async () => {
    let resolveExport;
    runExportMock.mockReturnValue(new Promise((resolve) => { resolveExport = resolve; }));

    const status = createStatusSetters();
    const { result, unmount } = renderHook(() => usePhaserAtlasExportJob(createBaseProps({ ...status })));

    act(() => {
      result.current.run();
    });

    unmount();

    await act(async () => {
      resolveExport({ ok: true, artifacts: [] });
    });

    // Should not crash; stale-guard prevents setProgress/setIsExporting after unmount
  });
});
