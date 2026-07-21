import { describe, expect, it, vi } from 'vitest';
import { runRasterExport } from '@/features/export/application/runRasterExport';

function makePlan(overrides = {}) {
  return {
    variantId: 'png_sequence',
    area: { source: { x: 0, y: 0, width: 100, height: 100 }, outputWidth: 100, outputHeight: 100 },
    fps: 2,
    animations: [{ id: 'a-1', name: 'test', duration: 2000 }],
    frameSpecs: [
      { animId: 'a-1', animName: 'test', frameIndex: 0, timeMs: 0 },
      { animId: 'a-1', animName: 'test', frameIndex: 1, timeMs: 500 },
    ],
    background: { enabled: false, color: '#ffffff' },
    ...overrides,
  };
}

describe('runRasterExport', () => {
  it('captures frames, encodes, and sinks on success path', async () => {
    const captureFrame = vi.fn((req) => ({
      ok: true, dataUrl: `data:${req.timeMs}`, width: req.width, height: req.height,
    }));
    const encoder = vi.fn(async ({ frames }) =>
      frames.map(f => ({ fileName: `frame_${f.frameIndex + 1}.png`, mimeType: 'image/png', blob: new Blob() }))
    );
    const outputSink = vi.fn();
    const onProgress = vi.fn();
    const plan = makePlan();

    const result = await runRasterExport({ plan, encoder, outputSink, captureFrame, format: 'png', onProgress });

    expect(result.ok).toBe(true);
    expect(result.artifacts).toHaveLength(2);
    expect(captureFrame).toHaveBeenCalledTimes(2);
    expect(encoder).toHaveBeenCalledOnce();
    expect(outputSink).toHaveBeenCalledOnce();
    expect(outputSink).toHaveBeenCalledWith(result.artifacts);
    expect(onProgress).toHaveBeenCalled();
  });

  it('passes encoder input with correct shape', async () => {
    const captureFrame = vi.fn((req) => ({
      ok: true, dataUrl: `data:${req.timeMs}`, width: 100, height: 100,
    }));
    const encoder = vi.fn(async ({ _frames, _area, _fps, _background, _animationName }) => []);
    const outputSink = vi.fn();
    const plan = makePlan();

    await runRasterExport({ plan, encoder, outputSink, captureFrame, format: 'png' });

    expect(encoder).toHaveBeenCalledOnce();
    const encoderInput = encoder.mock.calls[0][0];
    expect(encoderInput.frames).toHaveLength(2);
    expect(encoderInput.area).toBe(plan.area);
    expect(encoderInput.fps).toBe(2);
    expect(encoderInput.background).toBe(plan.background);
    expect(encoderInput.animationName).toBe('test');
  });

  it('returns error when capture returns failure', async () => {
    const captureFrame = vi.fn(() => ({ ok: false, error: { code: 'CAPTURE_ERR', message: 'Capture failed' } }));
    const encoder = vi.fn();
    const outputSink = vi.fn();

    const result = await runRasterExport({
      plan: makePlan(), encoder, outputSink, captureFrame, format: 'png',
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('CAPTURE_ERR');
    expect(encoder).not.toHaveBeenCalled();
    expect(outputSink).not.toHaveBeenCalled();
  });

  it('returns cancelled when capture is aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const captureFrame = vi.fn();

    const result = await runRasterExport({
      plan: makePlan(), encoder: vi.fn(), outputSink: vi.fn(), captureFrame, signal: controller.signal,
    });

    expect(result.ok).toBe(false);
    expect(result.cancelled).toBe(true);
  });

  it('returns error when encoder throws', async () => {
    const captureFrame = vi.fn((req) => ({ ok: true, dataUrl: `data:${req.timeMs}`, width: 100, height: 100 }));
    const encoder = vi.fn(async () => { throw new Error('Encoder OOM'); });
    const outputSink = vi.fn();

    const result = await runRasterExport({
      plan: makePlan(), encoder, outputSink, captureFrame, format: 'png',
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('EXPORT_FAILED');
    expect(result.error.message).toBe('Encoder OOM');
    expect(outputSink).not.toHaveBeenCalled();
  });

  it('returns cancelled when signal aborts after capture', async () => {
    const captureFrame = vi.fn((req) => ({ ok: true, dataUrl: `data:${req.timeMs}`, width: 100, height: 100 }));
    const controller = new AbortController();
    const encoder = vi.fn(async () => {
      controller.abort();
      return [];
    });

    const result = await runRasterExport({
      plan: makePlan(), encoder, outputSink: vi.fn(), captureFrame, format: 'png', signal: controller.signal,
    });

    expect(result.ok).toBe(false);
    expect(result.cancelled).toBe(true);
  });

  it('groups frames by animation for multi-animation export', async () => {
    const plan = makePlan({
      animations: [
        { id: 'a-1', name: 'idle', duration: 2000 },
        { id: 'a-2', name: 'walk', duration: 1000 },
      ],
      frameSpecs: [
        { animId: 'a-1', animName: 'idle', frameIndex: 0, timeMs: 0 },
        { animId: 'a-1', animName: 'idle', frameIndex: 1, timeMs: 500 },
        { animId: 'a-2', animName: 'walk', frameIndex: 0, timeMs: 0 },
      ],
    });
    const captureFrame = vi.fn((req) => ({ ok: true, dataUrl: `data:${req.timeMs}`, width: 100, height: 100 }));
    const encoder = vi.fn(async ({ animationName }) =>
      [{ fileName: `${animationName}.png`, mimeType: 'image/png', blob: new Blob() }]
    );
    const outputSink = vi.fn();

    const result = await runRasterExport({ plan, encoder, outputSink, captureFrame, format: 'png' });

    expect(encoder).toHaveBeenCalledTimes(2);
    expect(encoder.mock.calls[0][0].animationName).toBe('idle');
    expect(encoder.mock.calls[0][0].frames).toHaveLength(2);
    expect(encoder.mock.calls[1][0].animationName).toBe('walk');
    expect(result.artifacts).toHaveLength(2);
  });

  it('separates animations with the same name by stable animation ID', async () => {
    const plan = makePlan({
      animations: [
        { id: 'a-1', name: 'idle', duration: 500 },
        { id: '../a/2', name: 'idle', duration: 500 },
      ],
      frameSpecs: [
        { animId: 'a-1', animName: 'idle', frameIndex: 0, timeMs: 0 },
        { animId: '../a/2', animName: 'idle', frameIndex: 0, timeMs: 0 },
      ],
    });
    const captureFrame = vi.fn((req) => ({
      ok: true,
      dataUrl: `data:${req.animationId}`,
      width: 100,
      height: 100,
    }));
    const encoder = vi.fn(async ({ frames, animationName }) => [{
      fileName: `${animationName}.gif`,
      mimeType: 'image/gif',
      blob: new Blob(),
      frameAnimationIds: frames.map(frame => frame.animationId),
    }]);

    const result = await runRasterExport({
      plan,
      encoder,
      outputSink: vi.fn(),
      captureFrame,
      format: 'png',
    });

    expect(result.ok).toBe(true);
    expect(encoder).toHaveBeenCalledTimes(2);
    expect(encoder.mock.calls[0][0].animationName).toBe('idle');
    expect(encoder.mock.calls[0][0].frames.map(frame => frame.animationId)).toEqual(['a-1']);
    expect(encoder.mock.calls[1][0].animationName).toBe('idle_a_2');
    expect(encoder.mock.calls[1][0].frames.map(frame => frame.animationId)).toEqual(['../a/2']);
    expect(result.artifacts.map(artifact => artifact.fileName)).toEqual([
      'idle.gif',
      'idle_a_2.gif',
    ]);
  });

  it('propagates sink cancellation', async () => {
    const result = await runRasterExport({
      plan: makePlan(),
      encoder: vi.fn(async () => []),
      outputSink: vi.fn(async () => ({ ok: false, cancelled: true })),
      captureFrame: vi.fn((req) => ({
        ok: true, dataUrl: `data:${req.timeMs}`, width: 100, height: 100,
      })),
      format: 'png',
    });

    expect(result).toEqual({ ok: false, cancelled: true });
  });

  it('propagates sink write errors', async () => {
    const sinkError = { code: 'FOLDER_WRITE_FAILED', message: 'write failed' };
    const result = await runRasterExport({
      plan: makePlan(),
      encoder: vi.fn(async () => []),
      outputSink: vi.fn(async () => ({ ok: false, error: sinkError })),
      captureFrame: vi.fn((req) => ({
        ok: true, dataUrl: `data:${req.timeMs}`, width: 100, height: 100,
      })),
      format: 'png',
    });

    expect(result).toEqual({ ok: false, error: sinkError });
  });

  it('parity: mock png and gif encoders receive identical specs', async () => {
    const captureFrame = vi.fn((req) => ({ ok: true, dataUrl: `data:${req.timeMs}`, width: 100, height: 100 }));
    const pngEncoder = vi.fn(async ({ _frames, _area, _fps, _background }) => []);
    const gifEncoder = vi.fn(async ({ _frames, _area, _fps, _background }) => []);
    const plan = makePlan();

    await runRasterExport({ plan, encoder: pngEncoder, outputSink: vi.fn(), captureFrame, format: 'png' });
    await runRasterExport({ plan: makePlan({ variantId: 'gif' }), encoder: gifEncoder, outputSink: vi.fn(), captureFrame, format: 'png' });

    expect(pngEncoder.mock.calls[0][0].frames).toEqual(gifEncoder.mock.calls[0][0].frames);
    expect(pngEncoder.mock.calls[0][0].area).toEqual(gifEncoder.mock.calls[0][0].area);
    expect(pngEncoder.mock.calls[0][0].fps).toBe(gifEncoder.mock.calls[0][0].fps);
  });
});
