import { describe, expect, it } from 'vitest';
import { resolveProjectExportArea } from '@/features/export/domain/projectExportArea';

describe('resolveProjectExportArea', () => {
  it('returns source and scaled output for valid canvas', () => {
    const result = resolveProjectExportArea(
      { width: 640, height: 360, x: -120, y: 40, bgEnabled: false, bgColor: '#fff' },
      { scale: 1 },
    );
    expect(result).toEqual({
      source: { x: -120, y: 40, width: 640, height: 360 },
      outputWidth: 640,
      outputHeight: 360,
    });
  });

  it('applies scale to output dimensions', () => {
    const result = resolveProjectExportArea(
      { width: 640, height: 360, x: 0, y: 0 },
      { scale: 2 },
    );
    expect(result.outputWidth).toBe(1280);
    expect(result.outputHeight).toBe(720);
  });

  it('rounds fractional output dimensions', () => {
    const result = resolveProjectExportArea(
      { width: 100, height: 50, x: 0, y: 0 },
      { scale: 1.5 },
    );
    expect(result.outputWidth).toBe(150);
    expect(result.outputHeight).toBe(75);
  });

  it('minimum 1 pixel for small dimensions', () => {
    const result = resolveProjectExportArea(
      { width: 1, height: 1, x: 0, y: 0 },
      { scale: 0.1 },
    );
    expect(result.outputWidth).toBe(1);
    expect(result.outputHeight).toBe(1);
  });

  it('defaults scale to 1 when omitted', () => {
    const result = resolveProjectExportArea(
      { width: 800, height: 600, x: 0, y: 0 },
    );
    expect(result.outputWidth).toBe(800);
    expect(result.outputHeight).toBe(600);
  });

  it('preserves negative x/y origin', () => {
    const result = resolveProjectExportArea(
      { width: 640, height: 480, x: -200, y: -100 },
      { scale: 1 },
    );
    expect(result.source.x).toBe(-200);
    expect(result.source.y).toBe(-100);
    expect(result.source.width).toBe(640);
    expect(result.source.height).toBe(480);
  });

  it('throws for null canvas', () => {
    expect(() => resolveProjectExportArea(null)).toThrow(TypeError);
  });

  it('throws for non-positive width', () => {
    expect(() => resolveProjectExportArea({ width: 0, height: 100, x: 0, y: 0 }, { scale: 1 }))
      .toThrow(RangeError);
    expect(() => resolveProjectExportArea({ width: -1, height: 100, x: 0, y: 0 }, { scale: 1 }))
      .toThrow(RangeError);
  });

  it('throws for non-positive height', () => {
    expect(() => resolveProjectExportArea({ width: 100, height: 0, x: 0, y: 0 }, { scale: 1 }))
      .toThrow(RangeError);
  });

  it('throws for non-positive scale', () => {
    expect(() => resolveProjectExportArea({ width: 100, height: 100, x: 0, y: 0 }, { scale: 0 }))
      .toThrow(RangeError);
    expect(() => resolveProjectExportArea({ width: 100, height: 100, x: 0, y: 0 }, { scale: -1 }))
      .toThrow(RangeError);
  });

  it('throws for non-finite x/y', () => {
    expect(() => resolveProjectExportArea({ width: 100, height: 100, x: NaN, y: 0 }, { scale: 1 }))
      .toThrow(RangeError);
    expect(() => resolveProjectExportArea({ width: 100, height: 100, x: Infinity, y: 0 }, { scale: 1 }))
      .toThrow(RangeError);
  });
});
