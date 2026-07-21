import { describe, expect, it } from 'vitest';
import { computeExportFrameSpecs, sanitizeName } from '@/features/export/domain/exportFrameSpecs';

describe('sanitizeName', () => {
  it('replaces non-alphanumeric characters with underscore', () => {
    expect(sanitizeName('hello world')).toBe('hello_world');
    expect(sanitizeName('my-anim_1')).toBe('my-anim_1');
    expect(sanitizeName('test@#$file')).toBe('test_file');
  });

  it('collapses multiple underscores', () => {
    expect(sanitizeName('a  b')).toBe('a_b');
    expect(sanitizeName('a___b')).toBe('a_b');
  });

  it('trims leading/trailing underscores', () => {
    expect(sanitizeName('_hello_')).toBe('hello');
    expect(sanitizeName('__hi__')).toBe('hi');
  });

  it('defaults to "animation" for falsy names', () => {
    expect(sanitizeName(null)).toBe('animation');
    expect(sanitizeName(undefined)).toBe('animation');
    expect(sanitizeName('')).toBe('animation');
  });
});

describe('computeExportFrameSpecs', () => {
  const anims = [
    { id: 'anim-1', name: 'idle', duration: 2000 },
    { id: 'anim-2', name: 'walk', duration: 1000 },
  ];

  it('generates sequence frames for png_sequence type', () => {
    const specs = computeExportFrameSpecs({ type: 'png_sequence', animsToExport: anims, exportFps: 10, frameIndex: 0 });
    expect(specs).toHaveLength(30);
    expect(specs[0]).toEqual({ animId: 'anim-1', animName: 'idle', frameIndex: 0, timeMs: 0 });
    expect(specs[19]).toEqual({ animId: 'anim-1', animName: 'idle', frameIndex: 19, timeMs: 1900 });
    expect(specs[20]).toEqual({ animId: 'anim-2', animName: 'walk', frameIndex: 0, timeMs: 0 });
    expect(specs[29]).toEqual({ animId: 'anim-2', animName: 'walk', frameIndex: 9, timeMs: 900 });
  });

  it('generates sequence frames for gif type', () => {
    const specs = computeExportFrameSpecs({ type: 'gif', animsToExport: anims, exportFps: 5, frameIndex: 0 });
    expect(specs).toHaveLength(15);
    expect(specs[9]).toEqual({ animId: 'anim-1', animName: 'idle', frameIndex: 9, timeMs: 1800 });
  });

  it('generates the same frame schedule for spritesheets', () => {
    const specs = computeExportFrameSpecs({ type: 'png_spritesheet', animsToExport: anims, exportFps: 10 });
    expect(specs).toHaveLength(30);
    expect(specs[29]).toEqual({ animId: 'anim-2', animName: 'walk', frameIndex: 9, timeMs: 900 });
  });

  it('sanitizes animation names', () => {
    const dirty = [{ id: 'a-1', name: 'my anim!@#', duration: 1000 }];
    const specs = computeExportFrameSpecs({ type: 'png_sequence', animsToExport: dirty, exportFps: 1, frameIndex: 0 });
    expect(specs[0].animName).toBe('my_anim');
  });

  it('generates at least 1 frame per animation regardless of duration', () => {
    const single = [{ id: 'a-1', name: 'test', duration: 1 }];
    const specs = computeExportFrameSpecs({ type: 'png_sequence', animsToExport: single, exportFps: 1, frameIndex: 0 });
    expect(specs).toHaveLength(1);
  });

  it('throws for empty animsToExport', () => {
    expect(() => computeExportFrameSpecs({ type: 'png_sequence', animsToExport: [], exportFps: 24, frameIndex: 0 }))
      .toThrow(RangeError);
  });

  it('throws for invalid fps', () => {
    expect(() => computeExportFrameSpecs({ type: 'png_sequence', animsToExport: [{ id: 'a', name: 'x', duration: 1000 }], exportFps: 0, frameIndex: 0 }))
      .toThrow(RangeError);
    expect(() => computeExportFrameSpecs({ type: 'png_sequence', animsToExport: [{ id: 'a', name: 'x', duration: 1000 }], exportFps: -1, frameIndex: 0 }))
      .toThrow(RangeError);
  });
});
