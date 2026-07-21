import { describe, expect, it } from 'vitest';
import { createPhaserAtlasExportPlan } from '@/features/export/domain/phaserAtlasExportPlan';

function validArea(overrides = {}) {
  return {
    source: { x: 0, y: 0, width: 100, height: 100 },
    outputWidth: 100,
    outputHeight: 100,
    ...overrides,
  };
}

function validAnims() {
  return [
    { id: 'a-1', name: 'idle', duration: 2000 },
  ];
}

function validOpts(overrides = {}) {
  return {
    area: validArea(),
    fps: 24,
    scale: 100,
    animations: validAnims(),
    trim: true,
    padding: 2,
    maxPageSize: 2048,
    loop: true,
    outputName: 'test-char',
    destination: 'zip',
    ...overrides,
  };
}

describe('createPhaserAtlasExportPlan', () => {
  it('creates a frozen plan with correct fields', () => {
    const plan = createPhaserAtlasExportPlan(validOpts());

    expect(plan.variantId).toBe('phaser_atlas');
    expect(plan.fps).toBe(24);
    expect(plan.scale).toBe(100);
    expect(plan.trim).toBe(true);
    expect(plan.padding).toBe(2);
    expect(plan.maxPageSize).toBe(2048);
    expect(plan.loop).toBe(true);
    expect(plan.outputName).toBe('test-char');
    expect(plan.destination).toBe('zip');
    expect(plan.frameSpecs.length).toBeGreaterThan(0);
    expect(plan.animations).toHaveLength(1);
  });

  it('returns frozen plan (deep)', () => {
    const plan = createPhaserAtlasExportPlan(validOpts());

    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan.area)).toBe(true);
    expect(Object.isFrozen(plan.area.source)).toBe(true);
    expect(Object.isFrozen(plan.frameSpecs)).toBe(true);
    expect(Object.isFrozen(plan.animations)).toBe(true);
    expect(Object.isFrozen(plan.background)).toBe(true);
  });

  it('uses defaults for missing optional fields', () => {
    const plan = createPhaserAtlasExportPlan({
      area: validArea(),
      animations: validAnims(),
    });

    expect(plan.fps).toBe(24);
    expect(plan.scale).toBe(100);
    expect(plan.trim).toBe(true);
    expect(plan.padding).toBe(2);
    expect(plan.maxPageSize).toBe(2048);
    expect(plan.loop).toBe(true);
    expect(plan.destination).toBe('zip');
    expect(plan.outputName).toBe('phaser-export');
  });

  it('accepts folder destination', () => {
    const plan = createPhaserAtlasExportPlan(validOpts({ destination: 'folder' }));
    expect(plan.destination).toBe('folder');
  });

  it('normalizes invalid destination to zip', () => {
    const plan = createPhaserAtlasExportPlan(validOpts({ destination: 'download' }));
    expect(plan.destination).toBe('zip');
  });

  it('generates frame specs in animation selection order with shared FPS', () => {
    const plan = createPhaserAtlasExportPlan(validOpts({
      animations: [
        { id: 'a-1', name: 'idle', duration: 1000 },
        { id: 'a-2', name: 'walk', duration: 1000 },
      ],
      fps: 2,
    }));

    const idleFrames = plan.frameSpecs.filter(f => f.animId === 'a-1');
    const walkFrames = plan.frameSpecs.filter(f => f.animId === 'a-2');

    expect(idleFrames).toHaveLength(2);
    expect(walkFrames).toHaveLength(2);
    expect(plan.frameSpecs[0].animId).toBe('a-1');
    expect(plan.frameSpecs[2].animId).toBe('a-2');
  });

  it('rejects missing area', () => {
    expect(() => createPhaserAtlasExportPlan(validOpts({ area: null })))
      .toThrow('area must be an object');
  });

  it('rejects area with zero width', () => {
    expect(() => createPhaserAtlasExportPlan(validOpts({ area: validArea({ source: { x: 0, y: 0, width: 0, height: 100 } }) })))
      .toThrow('positive width/height');
  });

  it('rejects area with negative outputHeight', () => {
    expect(() => createPhaserAtlasExportPlan(validOpts({ area: validArea({ outputHeight: -1 }) })))
      .toThrow('outputHeight must be > 0');
  });

  it('rejects empty animations', () => {
    expect(() => createPhaserAtlasExportPlan(validOpts({ animations: [] })))
      .toThrow('At least one animation is required');
  });

  it('rejects invalid fps range', () => {
    expect(() => createPhaserAtlasExportPlan(validOpts({ fps: 0 })))
      .toThrow('fps must be');
  });

  it('rejects invalid scale range', () => {
    expect(() => createPhaserAtlasExportPlan(validOpts({ scale: 500 })))
      .toThrow('scale must be');
  });

  it('floors non-integer padding before validation', () => {
    const plan = createPhaserAtlasExportPlan(validOpts({ padding: 1.5 }));
    expect(plan.padding).toBe(1);
  });

  it('rejects invalid maxPageSize', () => {
    expect(() => createPhaserAtlasExportPlan(validOpts({ maxPageSize: 1024 })))
      .toThrow('maxPageSize must be one of');
  });

  it('does not mutate input', () => {
    const anims = [{ id: 'a-1', name: 'idle', duration: 1000 }];
    const area = validArea();
    const origAnim = { ...anims[0] };
    const origArea = { ...area, source: { ...area.source } };

    createPhaserAtlasExportPlan(validOpts({ animations: anims, area }));

    expect(anims[0]).toEqual(origAnim);
    expect(area).toEqual(origArea);
  });

  it('transparent background is invariant v1 default', () => {
    const plan = createPhaserAtlasExportPlan(validOpts({ background: undefined }));
    expect(plan.background).toEqual({ enabled: false, color: '#ffffff' });
  });

  it('rejects opaque background instead of silently changing baked pixels', () => {
    expect(() => createPhaserAtlasExportPlan(validOpts({
      background: { enabled: true, color: '#000000' },
    }))).toThrow('Phaser atlas export requires transparency');
  });

  it('raster plan still rejects phaser_atlas variant ID', async () => {
    const { createRasterExportPlan } = await import('@/features/export/domain/rasterExportPlan');
    expect(() => createRasterExportPlan({
      variantId: 'phaser_atlas',
      area: validArea(),
      fps: 24,
      animations: validAnims(),
    })).toThrow('variantId must be a raster variant ID');
  });
});
