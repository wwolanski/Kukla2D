import { describe, expect, it } from 'vitest';
import { createFrameCaptureRequestFromRasterPlan } from '@/features/export/domain/createFrameCaptureRequestFromRasterPlan';

describe('createFrameCaptureRequestFromRasterPlan', () => {
  const area = {
    source: { x: -120, y: 40, width: 640, height: 360 },
    outputWidth: 640,
    outputHeight: 360,
  };

  const frameSpec = {
    animId: 'anim-1',
    timeMs: 500,
    frameIndex: 12,
  };

  it('creates valid K5 request with crop matching source area', () => {
    const req = createFrameCaptureRequestFromRasterPlan({ area, frameSpec });

    expect(req.animationId).toBe('anim-1');
    expect(req.timeMs).toBe(500);
    expect(req.width).toBe(640);
    expect(req.height).toBe(360);
    expect(req.format).toBe('png');
    expect(req.crop).not.toBeNull();
    expect(req.crop.x).toBe(-120);
    expect(req.crop.y).toBe(40);
    expect(req.crop.width).toBe(640);
    expect(req.crop.height).toBe(360);
  });

  it('output dimensions match scaled area', () => {
    const scaledArea = {
      source: { x: 0, y: 0, width: 100, height: 100 },
      outputWidth: 200,
      outputHeight: 200,
    };
    const req = createFrameCaptureRequestFromRasterPlan({ area: scaledArea, frameSpec, format: 'webp' });
    expect(req.width).toBe(200);
    expect(req.height).toBe(200);
    expect(req.format).toBe('webp');
  });

  it('passes background settings', () => {
    const req = createFrameCaptureRequestFromRasterPlan({
      area,
      frameSpec,
      bgEnabled: true,
      bgColor: '#ff0000',
    });
    expect(req.background.enabled).toBe(true);
    expect(req.background.color).toBe('#ff0000');
  });

  it('defaults background to opaque white', () => {
    const req = createFrameCaptureRequestFromRasterPlan({ area, frameSpec });
    expect(req.background.enabled).toBe(true);
    expect(req.background.color).toBe('#ffffff');
  });

  it('throws when area missing', () => {
    expect(() => createFrameCaptureRequestFromRasterPlan({ frameSpec })).toThrow(TypeError);
  });

  it('throws when frameSpec missing', () => {
    expect(() => createFrameCaptureRequestFromRasterPlan({ area })).toThrow(TypeError);
  });
});
