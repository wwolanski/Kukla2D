import { describe, expect, it, vi } from 'vitest';
import { runPhaserAtlasExport } from '@/features/export/application/runPhaserAtlasExport';

function makePlan(overrides = {}) {
  return {
    variantId: 'phaser_atlas',
    area: { source: { x: 0, y: 0, width: 100, height: 100 }, outputWidth: 100, outputHeight: 100 },
    fps: 2,
    scale: 100,
    animations: [
      { id: 'a-1', name: 'idle', duration: 1000 },
      { id: 'a-2', name: 'walk', duration: 1000 },
    ],
    frameSpecs: [
      { animId: 'a-1', animName: 'idle', frameIndex: 0, timeMs: 0 },
      { animId: 'a-1', animName: 'idle', frameIndex: 1, timeMs: 500 },
      { animId: 'a-2', animName: 'walk', frameIndex: 0, timeMs: 0 },
      { animId: 'a-2', animName: 'walk', frameIndex: 1, timeMs: 500 },
    ],
    background: { enabled: false, color: '#ffffff' },
    trim: true,
    padding: 2,
    maxPageSize: 2048,
    loop: true,
    outputName: 'test-char',
    destination: 'zip',
    ...overrides,
  };
}

function successCapture(req) {
  return { ok: true, dataUrl: `data:image/png;base64,${req.timeMs}`, width: req.width, height: req.height };
}

function makeAdapter(overrides = {}) {
  return vi.fn(async (_frames, _opts) => ({
    ok: true,
    artifacts: [
      { fileName: 'test-char.png', mimeType: 'image/png', blob: new Blob(), relativePath: 'test-char/test-char.png' },
      { fileName: 'test-char.atlas.json', mimeType: 'application/json', blob: new Blob(), relativePath: 'test-char/test-char.atlas.json' },
      ...overrides.extraArtifacts ?? [],
    ],
  }));
}

describe('runPhaserAtlasExport', () => {
  it('calls capture once, adapter once, sink once on success', async () => {
    const captureFrame = vi.fn(successCapture);
    const adapter = makeAdapter();
    const outputSink = vi.fn(async () => ({ ok: true }));
    const onProgress = vi.fn();

    const result = await runPhaserAtlasExport({
      plan: makePlan(),
      captureFrame,
      adapter,
      outputSink,
      onProgress,
    });

    expect(result.ok).toBe(true);
    expect(result.artifacts).toHaveLength(2);
    expect(captureFrame).toHaveBeenCalledTimes(4);
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(outputSink).toHaveBeenCalledTimes(1);
    expect(adapter.mock.calls[0][0]).toHaveLength(4);
  });

  it('adapter receives all captured frames in single call', async () => {
    const captureFrame = vi.fn(successCapture);
    const adapter = makeAdapter();

    await runPhaserAtlasExport({
      plan: makePlan(),
      captureFrame,
      adapter,
      outputSink: vi.fn(async () => ({ ok: true })),
    });

    const adapterInput = adapter.mock.calls[0][0];
    expect(adapterInput).toHaveLength(4);
    expect(adapterInput[0].animId).toBe('a-1');
    expect(adapterInput[2].animId).toBe('a-2');
  });

  it('adapter options match plan', async () => {
    const adapter = makeAdapter();
    const plan = makePlan({ fps: 12, scale: 200, trim: false, padding: 4, maxPageSize: 4096, loop: false });

    await runPhaserAtlasExport({
      plan,
      captureFrame: vi.fn(successCapture),
      adapter,
      outputSink: vi.fn(async () => ({ ok: true })),
    });

    const opts = adapter.mock.calls[0][1];
    expect(opts.fps).toBe(12);
    expect(opts.scale).toBe(200);
    expect(opts.trim).toBe(false);
    expect(opts.padding).toBe(4);
    expect(opts.maxPageSize).toBe(4096);
    expect(opts.loop).toBe(false);
    expect(opts.outputName).toBe('test-char');
    expect(opts.destination).toBe('zip');
    expect(opts.animations).toHaveLength(2);
  });

  it('passes classified readiness issues to bake report input', async () => {
    const adapter = makeAdapter();
    const readinessReport = {
      errors: [],
      warnings: [
        { classification: 'baked', code: 'BAKED_RUNTIME_FEATURES', path: '$', message: 'Baked' },
        { classification: 'dropped', code: 'BAKED_AUDIO_EXCLUDED', path: '$', message: 'Dropped' },
      ],
    };

    await runPhaserAtlasExport({
      plan: makePlan(),
      captureFrame: vi.fn(successCapture),
      adapter,
      outputSink: vi.fn(async () => ({ ok: true })),
      readinessReport,
    });

    expect(adapter.mock.calls[0][1].bakeIssues).toEqual(readinessReport.warnings);
  });

  it('returns error when capture fails', async () => {
    const captureFrame = vi.fn(() => ({ ok: false, error: { code: 'CAPTURE_ERR', message: 'fail' } }));
    const adapter = makeAdapter();
    const outputSink = vi.fn();

    const result = await runPhaserAtlasExport({
      plan: makePlan(),
      captureFrame,
      adapter,
      outputSink,
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('CAPTURE_ERR');
    expect(adapter).not.toHaveBeenCalled();
    expect(outputSink).not.toHaveBeenCalled();
  });

  it('returns cancelled when signal aborted before capture', async () => {
    const controller = new AbortController();
    controller.abort();

    const result = await runPhaserAtlasExport({
      plan: makePlan(),
      captureFrame: vi.fn(),
      adapter: makeAdapter(),
      outputSink: vi.fn(),
      signal: controller.signal,
    });

    expect(result.ok).toBe(false);
    expect(result.cancelled).toBe(true);
  });

  it('returns cancelled when adapter returns PHASER_ATLAS_CANCELLED', async () => {
    const adapter = vi.fn(async () => ({ ok: false, code: 'PHASER_ATLAS_CANCELLED', message: 'Export cancelled' }));

    const result = await runPhaserAtlasExport({
      plan: makePlan(),
      captureFrame: vi.fn(successCapture),
      adapter,
      outputSink: vi.fn(),
    });

    expect(result.ok).toBe(false);
    expect(result.cancelled).toBe(true);
  });

  it('returns error when adapter returns typed error', async () => {
    const adapter = vi.fn(async () => ({
      ok: false,
      code: 'PHASER_ATLAS_OVERSIZED_FRAME',
      message: 'Frame too large',
    }));

    const result = await runPhaserAtlasExport({
      plan: makePlan(),
      captureFrame: vi.fn(successCapture),
      adapter,
      outputSink: vi.fn(),
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('PHASER_ATLAS_OVERSIZED_FRAME');
    expect(result.error.message).toBe('Frame too large');
    expect(result.cancelled).toBeUndefined();
  });

  it('returns error when adapter produces empty artifacts', async () => {
    const adapter = vi.fn(async () => ({ ok: true, artifacts: [] }));

    const result = await runPhaserAtlasExport({
      plan: makePlan(),
      captureFrame: vi.fn(successCapture),
      adapter,
      outputSink: vi.fn(),
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('EMPTY_PACKAGE');
  });

  it('returns error when sink fails', async () => {
    const sinkError = { code: 'FOLDER_WRITE_FAILED', message: 'write failed' };

    const result = await runPhaserAtlasExport({
      plan: makePlan(),
      captureFrame: vi.fn(successCapture),
      adapter: makeAdapter(),
      outputSink: vi.fn(async () => ({ ok: false, error: sinkError })),
    });

    expect(result.ok).toBe(false);
    expect(result.error).toEqual(sinkError);
  });

  it('returns cancelled when sink cancels', async () => {
    const result = await runPhaserAtlasExport({
      plan: makePlan(),
      captureFrame: vi.fn(successCapture),
      adapter: makeAdapter(),
      outputSink: vi.fn(async () => ({ ok: false, cancelled: true })),
    });

    expect(result.ok).toBe(false);
    expect(result.cancelled).toBe(true);
  });

  it('does not call sink when adapter fails', async () => {
    const outputSink = vi.fn();

    await runPhaserAtlasExport({
      plan: makePlan(),
      captureFrame: vi.fn(successCapture),
      adapter: vi.fn(async () => ({ ok: false, code: 'ERR', message: 'fail' })),
      outputSink,
    });

    expect(outputSink).not.toHaveBeenCalled();
  });

  it('reports progress phases', async () => {
    const onProgress = vi.fn();

    await runPhaserAtlasExport({
      plan: makePlan(),
      captureFrame: vi.fn(successCapture),
      adapter: makeAdapter(),
      outputSink: vi.fn(async () => ({ ok: true })),
      onProgress,
    });

    const labels = onProgress.mock.calls.map(c => c[0]?.label).filter(Boolean);
    expect(labels.some(l => l.includes('Capturing'))).toBe(true);
    expect(labels.some(l => l.includes('Trimming'))).toBe(true);
    expect(labels.some(l => l.includes('Writing'))).toBe(true);
    expect(labels).toContain('Done');
  });

  it('returns EXPORT_FAILED when capture throws', async () => {
    const result = await runPhaserAtlasExport({
      plan: makePlan(),
      captureFrame: vi.fn(() => { throw new Error('Canvas exploded'); }),
      adapter: makeAdapter(),
      outputSink: vi.fn(),
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('EXPORT_FAILED');
    expect(result.error.message).toBe('Canvas exploded');
  });

  it('cancel mid-capture returns cancelled', async () => {
    const controller = new AbortController();
    let callCount = 0;
    const captureFrame = vi.fn((req) => {
      callCount++;
      if (callCount === 3) controller.abort();
      return successCapture(req);
    });

    const result = await runPhaserAtlasExport({
      plan: makePlan(),
      captureFrame,
      adapter: makeAdapter(),
      outputSink: vi.fn(),
      signal: controller.signal,
    });

    expect(result.ok).toBe(false);
    expect(result.cancelled).toBe(true);
  });
});
