// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRasterExportJob } from '@/features/export/application/useRasterExportJob';
import { act, renderHook } from '../renderHook.jsx';

const runExportMock = vi.hoisted(() => vi.fn());
const createPlanMock = vi.hoisted(() => vi.fn());

vi.mock('@/features/export/application/runRasterExport', () => ({ runRasterExport: runExportMock }));
vi.mock('@/features/export/domain/rasterExportPlan', () => ({ createRasterExportPlan: createPlanMock }));
vi.mock('@/features/export/application/resolveExportEncoder', () => ({
  resolveExportEncoder: vi.fn(() => vi.fn()),
}));
vi.mock('@/features/export/infrastructure/browserExportSink', () => ({
  browserExportSink: vi.fn(),
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
    canvas: { width: 100, height: 100, x: 0, y: 0, bgEnabled: false, bgColor: '#000' },
    textures: [],
    nodes: [],
    animations: [{ id: 'anim-1', name: 'idle', duration: 2000, fps: 24, tracks: [] }],
  };
}

function createBaseProps(overrides = {}) {
  return {
    captureRef: { current: vi.fn(() => ({ ok: true, dataUrl: 'data:png', width: 100, height: 100 })) },
    project: createValidProject(),
    type: 'png_sequence',
    format: 'png',
    targetAnims: [{ id: 'anim-1', name: 'idle', duration: 2000 }],
    exportFps: 24,
    frameIndex: 0,
    outputScale: 100,
    bgMode: 'custom',
    bgColor: '#ffffff',
    ...createStatusSetters(),
    ...overrides,
  };
}

describe('export job hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runExportMock.mockResolvedValue({ ok: true, artifacts: [] });
    createPlanMock.mockReturnValue({
      variantId: 'png_sequence',
      area: { source: { x: 0, y: 0, width: 100, height: 100 }, outputWidth: 100, outputHeight: 100 },
      fps: 24,
      animations: [{ id: 'anim-1', name: 'idle', duration: 2000 }],
      frameSpecs: [{ animId: 'anim-1', animName: 'idle', frameIndex: 0, timeMs: 0 }],
      background: { enabled: true, color: '#ffffff' },
    });
  });

  it('blocks legacy Live2D type with UNSUPPORTED_FORMAT', async () => {
    const status = createStatusSetters();
    const { result } = renderHook(() => useRasterExportJob({
      captureRef: { current: null },
      project: { canvas: { width: 100, height: 100 } },
      type: 'live2d',
      format: 'png',
      targetAnims: [],
      exportFps: 24,
      frameIndex: 0,
      outputScale: 100,
      bgMode: 'transparent',
      bgColor: '#ffffff',
      ...status,
    }));

    await act(async () => {
      await result.current();
    });

    expect(status.setExportError).toHaveBeenCalledWith('UNSUPPORTED_FORMAT');
    expect(status.setIsExporting).not.toHaveBeenCalled();
  });

  it('blocks legacy Live2D Project type with UNSUPPORTED_FORMAT', async () => {
    const status = createStatusSetters();
    const { result } = renderHook(() => useRasterExportJob({
      captureRef: { current: null },
      project: { canvas: { width: 100, height: 100 } },
      type: 'live2d_project',
      format: 'png',
      targetAnims: [],
      exportFps: 24,
      frameIndex: 0,
      outputScale: 100,
      bgMode: 'transparent',
      bgColor: '#ffffff',
      ...status,
    }));

    await act(async () => {
      await result.current();
    });

    expect(status.setExportError).toHaveBeenCalledWith('UNSUPPORTED_FORMAT');
  });

  it('blocks legacy Spine type with UNSUPPORTED_FORMAT', async () => {
    const status = createStatusSetters();
    const { result } = renderHook(() => useRasterExportJob({
      captureRef: { current: null },
      project: { canvas: { width: 100, height: 100 } },
      type: 'spine',
      format: 'png',
      targetAnims: [],
      exportFps: 24,
      frameIndex: 0,
      outputScale: 100,
      bgMode: 'transparent',
      bgColor: '#ffffff',
      ...status,
    }));

    await act(async () => {
      await result.current();
    });

    expect(status.setExportError).toHaveBeenCalledWith('UNSUPPORTED_FORMAT');
  });

  it('creates plan and calls runRasterExport for active variant', async () => {
    const status = createStatusSetters();
    const { result } = renderHook(() => useRasterExportJob(createBaseProps({ ...status })));

    await act(async () => {
      await result.current();
    });

    expect(createPlanMock).toHaveBeenCalledOnce();
    expect(runExportMock).toHaveBeenCalledOnce();
    expect(status.setIsExporting).toHaveBeenLastCalledWith(false);
    expect(status.setExportError).not.toHaveBeenCalled();
  });

  it('passes correct props to createRasterExportPlan', async () => {
    const status = createStatusSetters();
    const { result } = renderHook(() => useRasterExportJob(createBaseProps({
      type: 'gif',
      targetAnims: [{ id: 'anim-1', name: 'idle', duration: 2000 }],
      exportFps: 12,
      outputScale: 50,
      bgMode: 'transparent',
      bgColor: '#ff0000',
      ...status,
    })));

    await act(async () => {
      await result.current();
    });

    const planArgs = createPlanMock.mock.calls[0][0];
    expect(planArgs.variantId).toBe('gif');
    expect(planArgs.fps).toBe(12);
    expect(planArgs.background.enabled).toBe(false);
    expect(planArgs.background.color).toBe('#ff0000');
  });

  it('keeps frame capture PNG and forwards spritesheet columns', async () => {
    const status = createStatusSetters();
    const { result } = renderHook(() => useRasterExportJob(createBaseProps({
      type: 'png_spritesheet',
      format: 'png',
      spriteSheetColumns: 4,
      ...status,
    })));

    await act(async () => { await result.current(); });

    expect(createPlanMock.mock.calls[0][0].spriteSheet).toEqual({ columns: 4 });
    expect(runExportMock.mock.calls[0][0].format).toBe('png');
  });

  it('sets export error when runRasterExport returns failure', async () => {
    runExportMock.mockResolvedValue({ ok: false, error: { code: 'CAPTURE_FAILED', message: 'Capture failed' } });

    const status = createStatusSetters();
    const { result } = renderHook(() => useRasterExportJob(createBaseProps({ ...status })));

    await act(async () => {
      await result.current();
    });

    expect(status.setExportError).toHaveBeenCalledWith('Capture failed');
    expect(status.setIsExporting).toHaveBeenLastCalledWith(false);
  });

  it('handles cancelled export gracefully', async () => {
    runExportMock.mockResolvedValue({ ok: false, cancelled: true });

    const status = createStatusSetters();
    const { result } = renderHook(() => useRasterExportJob(createBaseProps({ ...status })));

    await act(async () => {
      await result.current();
    });

    expect(status.setExportError).not.toHaveBeenCalled();
    expect(status.setIsExporting).toHaveBeenLastCalledWith(false);
  });

  it('handles exception from runRasterExport', async () => {
    runExportMock.mockRejectedValue(new Error('Something went wrong'));

    const status = createStatusSetters();
    const { result } = renderHook(() => useRasterExportJob(createBaseProps({ ...status })));

    await act(async () => {
      await result.current();
    });

    expect(status.setExportError).toHaveBeenCalledWith('Something went wrong');
    expect(status.setIsExporting).toHaveBeenLastCalledWith(false);
  });

  it('does not export when captureRef is null', async () => {
    const status = createStatusSetters();
    const { result } = renderHook(() => useRasterExportJob(createBaseProps({
      captureRef: { current: null },
      ...status,
    })));

    await act(async () => {
      await result.current();
    });

    expect(runExportMock).not.toHaveBeenCalled();
    expect(status.setIsExporting).not.toHaveBeenCalled();
  });
});
