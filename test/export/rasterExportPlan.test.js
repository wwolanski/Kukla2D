import { describe, expect, it } from 'vitest';
import { createRasterExportPlan } from '@/features/export/domain/rasterExportPlan';

function validArea() {
  return {
    source: { x: -120, y: 40, width: 640, height: 360 },
    outputWidth: 640,
    outputHeight: 360,
  };
}

function validAnimations() {
  return [{ id: 'anim-1', name: 'idle', duration: 2000 }];
}

describe('createRasterExportPlan', () => {
  it('creates frozen plan with valid inputs', () => {
    const plan = createRasterExportPlan({
      variantId: 'png_sequence',
      area: validArea(),
      fps: 24,
      animations: validAnimations(),
      frameIndex: 0,
      background: { enabled: false, color: '#ffffff' },
    });

    expect(Object.isFrozen(plan)).toBe(true);
    expect(plan.variantId).toBe('png_sequence');
    expect(plan.area.source.x).toBe(-120);
    expect(plan.area.source.width).toBe(640);
    expect(plan.area.outputWidth).toBe(640);
    expect(plan.fps).toBe(24);
    expect(plan.frameSpecs.length).toBeGreaterThan(0);
  });

  it('stores spritesheet config and generates all frames', () => {
    const plan = createRasterExportPlan({
      variantId: 'png_spritesheet',
      area: validArea(),
      fps: 24,
      animations: [{ id: 'a-1', name: 'test', duration: 1000 }],
      spriteSheet: { columns: 5 },
      background: { enabled: false, color: '#000' },
    });

    expect(plan.frameSpecs).toHaveLength(24);
    expect(plan.spriteSheet).toEqual({ columns: 5 });
  });

  it('uses variantId as the only frame-spec dispatch key', () => {
    const plan = createRasterExportPlan({
      variantId: 'gif',
      area: validArea(),
      fps: 10,
      animations: [{ id: 'a-1', name: 'test', duration: 2000 }],
      background: { enabled: false, color: '#fff' },
    });

    expect(plan.variantId).toBe('gif');
    expect(plan.frameSpecs.length).toBe(20);
  });

  it('throws for empty animations', () => {
    expect(() => createRasterExportPlan({
      variantId: 'png_sequence',
      area: validArea(),
      fps: 24,
      animations: [],
      background: { enabled: false, color: '#fff' },
    })).toThrow(RangeError);
  });

  it('throws for invalid area', () => {
    expect(() => createRasterExportPlan({
      variantId: 'png_sequence',
      area: null,
      fps: 24,
      animations: validAnimations(),
      background: { enabled: false, color: '#fff' },
    })).toThrow(TypeError);

    expect(() => createRasterExportPlan({
      variantId: 'png_sequence',
      area: { ...validArea(), source: { x: NaN, y: 0, width: 100, height: 100 } },
      fps: 24,
      animations: validAnimations(),
    })).toThrow(TypeError);

    expect(() => createRasterExportPlan({
      variantId: 'png_sequence',
      area: { ...validArea(), source: { x: 0, y: 0, width: -1, height: 100 } },
      fps: 24,
      animations: validAnimations(),
    })).toThrow(TypeError);

    expect(() => createRasterExportPlan({
      variantId: 'png_sequence',
      area: { source: { x: 0, y: 0, width: 0, height: 100 } },
      fps: 24,
      animations: validAnimations(),
      background: { enabled: false, color: '#fff' },
    })).toThrow(TypeError);
  });

  it('uses default background when not provided', () => {
    const plan = createRasterExportPlan({
      variantId: 'png_sequence',
      area: validArea(),
      fps: 24,
      animations: validAnimations(),
    });

    expect(plan.background).toEqual({ enabled: false, color: '#ffffff' });
  });

  it('frame specs are frozen immutables', () => {
    const plan = createRasterExportPlan({
      variantId: 'png_sequence',
      area: validArea(),
      fps: 1,
      animations: [{ id: 'a-1', name: 'test', duration: 2000 }],
      background: { enabled: false, color: '#fff' },
    });

    expect(Object.isFrozen(plan.frameSpecs)).toBe(true);
    expect(Object.isFrozen(plan.frameSpecs[0])).toBe(true);
  });

  it('output dimensions match area contract', () => {
    const area = validArea();
    const plan = createRasterExportPlan({
      variantId: 'png_sequence',
      area,
      fps: 1,
      animations: [{ id: 'a-1', name: 'test', duration: 1000 }],
      background: { enabled: false, color: '#fff' },
    });

    expect(plan.area.outputWidth).toBe(area.outputWidth);
    expect(plan.area.outputHeight).toBe(area.outputHeight);
  });

  it('rejects non-raster variant IDs', () => {
    const area = validArea();
    const animations = validAnimations();
    expect(() => createRasterExportPlan({
      variantId: 'live2d',
      area, fps: 10, animations,
      background: { enabled: false, color: '#fff' },
    })).toThrow(TypeError);

    expect(() => createRasterExportPlan({
      variantId: 'spine',
      area, fps: 10, animations,
      background: { enabled: false, color: '#fff' },
    })).toThrow(TypeError);
  });

  it('parity: png_sequence and gif get same frame specs for same animation', () => {
    const animations = [{ id: 'a-1', name: 'test', duration: 2000 }];
    const area = validArea();

    const pngPlan = createRasterExportPlan({ variantId: 'png_sequence', area, fps: 10, animations, background: { enabled: false, color: '#fff' } });
    const gifPlan = createRasterExportPlan({ variantId: 'gif', area, fps: 10, animations, background: { enabled: false, color: '#fff' } });

    expect(pngPlan.frameSpecs).toEqual(gifPlan.frameSpecs);
    expect(pngPlan.area).toEqual(gifPlan.area);
    expect(pngPlan.fps).toBe(gifPlan.fps);
  });

  it('parity: png spritesheet captures same frames as png sequence', () => {
    const animations = [{ id: 'a-1', name: 'test', duration: 1200 }];
    const area = validArea();
    const sequence = createRasterExportPlan({ variantId: 'png_sequence', area, fps: 10, animations });
    const sheet = createRasterExportPlan({ variantId: 'png_spritesheet', area, fps: 10, animations, spriteSheet: { columns: 4 } });
    expect(sheet.frameSpecs).toEqual(sequence.frameSpecs);
  });
});
