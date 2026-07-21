import { describe, expect, it, vi } from 'vitest';
import { captureRasterFrames } from '@/features/export/application/captureRasterFrames';

function makePlan(overrides = {}) {
  return {
    variantId: 'png_sequence',
    area: { source: { x: 0, y: 0, width: 100, height: 100 }, outputWidth: 100, outputHeight: 100 },
    fps: 2,
    animations: [{ id: 'a-1', name: 'test', duration: 2000 }],
    frameSpecs: [
      { animId: 'a-1', animName: 'test', frameIndex: 0, timeMs: 0 },
      { animId: 'a-1', animName: 'test', frameIndex: 1, timeMs: 500 },
      { animId: 'a-1', animName: 'test', frameIndex: 2, timeMs: 1000 },
      { animId: 'a-1', animName: 'test', frameIndex: 3, timeMs: 1500 },
    ],
    background: { enabled: false, color: '#ffffff' },
    ...overrides,
  };
}

function successCapture(req) {
  return { ok: true, dataUrl: `data:image/png;base64,frame-${req.timeMs}`, width: req.width, height: req.height };
}

describe('captureRasterFrames', () => {
  it('captures all frames in plan order', async () => {
    const plan = makePlan();
    const captureFrame = vi.fn(successCapture);
    const onProgress = vi.fn();

    const result = await captureRasterFrames({ plan, captureFrame, format: 'png', onProgress });

    expect(result.ok).toBe(true);
    expect(result.frames).toHaveLength(4);
    expect(captureFrame).toHaveBeenCalledTimes(4);
    expect(result.frames[0].timeMs).toBe(0);
    expect(result.frames[3].timeMs).toBe(1500);
    expect(onProgress).toHaveBeenCalled();
  });

  it('passes correct K5 crop from area', async () => {
    const plan = makePlan({
      area: { source: { x: -120, y: 40, width: 640, height: 360 }, outputWidth: 640, outputHeight: 360 },
    });
    const captureFrame = vi.fn(successCapture);

    await captureRasterFrames({ plan, captureFrame });

    const request = captureFrame.mock.calls[0][0];
    expect(request.crop.x).toBe(-120);
    expect(request.crop.y).toBe(40);
    expect(request.crop.width).toBe(640);
    expect(request.crop.height).toBe(360);
    expect(request.width).toBe(640);
    expect(request.height).toBe(360);
  });

  it('output frames have correct CapturedRasterFrame shape', async () => {
    const plan = makePlan();
    const captureFrame = vi.fn(successCapture);

    const result = await captureRasterFrames({ plan, captureFrame });
    const frame = result.frames[0];

    expect(frame).toHaveProperty('animationId', 'a-1');
    expect(frame).toHaveProperty('animationName', 'test');
    expect(frame).toHaveProperty('frameIndex', 0);
    expect(frame).toHaveProperty('timeMs', 0);
    expect(frame).toHaveProperty('width', 100);
    expect(frame).toHaveProperty('height', 100);
    expect(frame).toHaveProperty('dataUrl');
  });

  it('returns error when capture fails', async () => {
    const plan = makePlan();
    const captureFrame = vi.fn(() => ({
      ok: false,
      error: { code: 'NO_CANVAS', message: 'Canvas not available' },
    }));

    const result = await captureRasterFrames({ plan, captureFrame });

    expect(result.ok).toBe(false);
    expect(result.error.message).toBe('Canvas not available');
  });

  it('returns error when capture returns null', async () => {
    const plan = makePlan();
    const captureFrame = vi.fn(() => null);

    const result = await captureRasterFrames({ plan, captureFrame });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('CAPTURE_FAILED');
  });

  it('stops capture on first error and does not continue to later frames', async () => {
    const captureFrame = vi.fn()
      .mockReturnValueOnce({ ok: true, dataUrl: 'frame-0', width: 100, height: 100 })
      .mockReturnValueOnce({ ok: false, error: { code: 'ERR', message: 'fail' } });

    const plan = makePlan();
    const result = await captureRasterFrames({ plan, captureFrame });

    expect(result.ok).toBe(false);
    expect(captureFrame).toHaveBeenCalledTimes(2);
  });

  it('returns cancelled when signal is aborted', async () => {
    const plan = makePlan();
    const captureFrame = vi.fn(successCapture);
    const controller = new AbortController();
    controller.abort();

    const result = await captureRasterFrames({ plan, captureFrame, signal: controller.signal });

    expect(result.ok).toBe(false);
    expect(result.cancelled).toBe(true);
  });

  it('aborts mid-way through frame capture', async () => {
    const plan = makePlan();
    const controller = new AbortController();

    let callCount = 0;
    const intercept = vi.fn((req) => {
      callCount++;
      if (callCount === 3) controller.abort();
      return successCapture(req);
    });

    const result = await captureRasterFrames({ plan, captureFrame: intercept, signal: controller.signal });

    expect(result.ok).toBe(false);
    expect(result.cancelled).toBe(true);
    expect(callCount).toBeLessThan(4);
  });

  it('reports progress for each frame', async () => {
    const plan = makePlan();
    const captureFrame = vi.fn(successCapture);
    const onProgress = vi.fn();

    await captureRasterFrames({ plan, captureFrame, onProgress });

    expect(onProgress).toHaveBeenCalledTimes(4);
    expect(onProgress).toHaveBeenLastCalledWith({ current: 4, total: 4, label: 'test — frame 4' });
  });

  it('returns error for invalid plan', async () => {
    const result = await captureRasterFrames({ plan: null, captureFrame: vi.fn() });
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('INVALID_PLAN');
  });
});
