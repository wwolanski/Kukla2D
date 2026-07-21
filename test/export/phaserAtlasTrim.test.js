import { describe, expect, it } from 'vitest';
import { scanAlphaBounds } from '../../packages/adapters/phaser-atlas/src/index.js';

function makeRGBA(width, height, paint) {
  const data = new Uint8ClampedArray(width * height * 4);
  paint(data, width, height);
  return data;
}

function setPixel(data, width, x, y, r, g, b, a = 255) {
  const i = (y * width + x) * 4;
  data[i] = r;
  data[i + 1] = g;
  data[i + 2] = b;
  data[i + 3] = a;
}

describe('scanAlphaBounds', () => {
  describe('validation', () => {
    it('rejects non-positive width', () => {
      expect(() => scanAlphaBounds(0, 4, new Uint8ClampedArray(0), true)).toThrow('width must be a positive integer');
    });

    it('rejects negative height', () => {
      expect(() => scanAlphaBounds(4, -1, new Uint8ClampedArray(0), true)).toThrow('height must be a positive integer');
    });

    it('rejects mismatched buffer length', () => {
      expect(() => scanAlphaBounds(4, 4, new Uint8ClampedArray(10), true)).toThrow('RGBA buffer length');
    });

    it('rejects non-integer width', () => {
      expect(() => scanAlphaBounds(2.5, 4, new Uint8ClampedArray(40), true)).toThrow('width must be a positive integer');
    });
  });

  describe('trim=false', () => {
    it('returns full canvas rect', () => {
      const rgba = makeRGBA(8, 6, () => {});
      const result = scanAlphaBounds(8, 6, rgba, false);
      expect(result).toEqual({
        cropX: 0, cropY: 0, cropW: 8, cropH: 6,
        sourceWidth: 8, sourceHeight: 6, empty: false,
      });
    });
  });

  describe('trim=true — content at each corner', () => {
    it('top-left pixel', () => {
      const rgba = makeRGBA(8, 8, (d) => setPixel(d, 8, 0, 0, 255, 0, 0));
      const result = scanAlphaBounds(8, 8, rgba, true);
      expect(result).toEqual({
        cropX: 0, cropY: 0, cropW: 1, cropH: 1,
        sourceWidth: 8, sourceHeight: 8, empty: false,
      });
    });

    it('top-right pixel', () => {
      const rgba = makeRGBA(8, 8, (d) => setPixel(d, 8, 7, 0, 0, 255, 0));
      const result = scanAlphaBounds(8, 8, rgba, true);
      expect(result).toEqual({
        cropX: 7, cropY: 0, cropW: 1, cropH: 1,
        sourceWidth: 8, sourceHeight: 8, empty: false,
      });
    });

    it('bottom-left pixel', () => {
      const rgba = makeRGBA(8, 8, (d) => setPixel(d, 8, 0, 7, 0, 0, 255));
      const result = scanAlphaBounds(8, 8, rgba, true);
      expect(result).toEqual({
        cropX: 0, cropY: 7, cropW: 1, cropH: 1,
        sourceWidth: 8, sourceHeight: 8, empty: false,
      });
    });

    it('bottom-right pixel', () => {
      const rgba = makeRGBA(8, 8, (d) => setPixel(d, 8, 7, 7, 255, 255, 0));
      const result = scanAlphaBounds(8, 8, rgba, true);
      expect(result).toEqual({
        cropX: 7, cropY: 7, cropW: 1, cropH: 1,
        sourceWidth: 8, sourceHeight: 8, empty: false,
      });
    });
  });

  describe('trim=true — asymmetric content', () => {
    it('content in center region', () => {
      const rgba = makeRGBA(10, 10, (d) => {
        for (let y = 3; y <= 6; y++) {
          for (let x = 2; x <= 7; x++) {
            setPixel(d, 10, x, y, 128, 128, 128);
          }
        }
      });
      const result = scanAlphaBounds(10, 10, rgba, true);
      expect(result).toEqual({
        cropX: 2, cropY: 3, cropW: 6, cropH: 4,
        sourceWidth: 10, sourceHeight: 10, empty: false,
      });
    });

    it('single pixel at offset position', () => {
      const rgba = makeRGBA(16, 16, (d) => setPixel(d, 16, 5, 12, 255, 0, 128));
      const result = scanAlphaBounds(16, 16, rgba, true);
      expect(result).toEqual({
        cropX: 5, cropY: 12, cropW: 1, cropH: 1,
        sourceWidth: 16, sourceHeight: 16, empty: false,
      });
    });

    it('content spanning full width but partial height', () => {
      const rgba = makeRGBA(8, 6, (d) => {
        for (let x = 0; x < 8; x++) {
          setPixel(d, 8, x, 2, 255, 0, 0);
          setPixel(d, 8, x, 3, 0, 255, 0);
        }
      });
      const result = scanAlphaBounds(8, 6, rgba, true);
      expect(result).toEqual({
        cropX: 0, cropY: 2, cropW: 8, cropH: 2,
        sourceWidth: 8, sourceHeight: 6, empty: false,
      });
    });

    it('L-shaped content uses bounding box', () => {
      const rgba = makeRGBA(6, 6, (d) => {
        setPixel(d, 6, 0, 0, 255, 0, 0);
        setPixel(d, 6, 0, 1, 255, 0, 0);
        setPixel(d, 6, 0, 2, 255, 0, 0);
        setPixel(d, 6, 1, 2, 255, 0, 0);
        setPixel(d, 6, 2, 2, 255, 0, 0);
      });
      const result = scanAlphaBounds(6, 6, rgba, true);
      expect(result).toEqual({
        cropX: 0, cropY: 0, cropW: 3, cropH: 3,
        sourceWidth: 6, sourceHeight: 6, empty: false,
      });
    });
  });

  describe('empty frame', () => {
    it('all-zero alpha returns 1×1 with source dimensions', () => {
      const rgba = makeRGBA(12, 8, () => {});
      const result = scanAlphaBounds(12, 8, rgba, true);
      expect(result).toEqual({
        cropX: 0, cropY: 0, cropW: 1, cropH: 1,
        sourceWidth: 12, sourceHeight: 8, empty: true,
      });
    });

    it('transparent frame with RGB but zero alpha is empty', () => {
      const rgba = makeRGBA(4, 4, (d) => {
        for (let i = 0; i < d.length; i += 4) {
          d[i] = 255;
          d[i + 1] = 0;
          d[i + 2] = 0;
          d[i + 3] = 0;
        }
      });
      const result = scanAlphaBounds(4, 4, rgba, true);
      expect(result.empty).toBe(true);
      expect(result.cropW).toBe(1);
      expect(result.cropH).toBe(1);
    });

    it('preserves source dimensions for empty frame', () => {
      const rgba = makeRGBA(100, 50, () => {});
      const result = scanAlphaBounds(100, 50, rgba, true);
      expect(result.sourceWidth).toBe(100);
      expect(result.sourceHeight).toBe(50);
    });
  });

  describe('full frame content', () => {
    it('fully opaque frame trims to full size', () => {
      const rgba = makeRGBA(4, 3, (d) => {
        for (let i = 0; i < d.length; i++) d[i] = 255;
      });
      const result = scanAlphaBounds(4, 3, rgba, true);
      expect(result).toEqual({
        cropX: 0, cropY: 0, cropW: 4, cropH: 3,
        sourceWidth: 4, sourceHeight: 3, empty: false,
      });
    });
  });
});
