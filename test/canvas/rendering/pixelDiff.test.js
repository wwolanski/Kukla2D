// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { compareImageData } from './pixelDiff.js';

class PolyfillImageData {
  constructor(dataOrLength, width, height) {
    if (dataOrLength instanceof Uint8ClampedArray) {
      this.data = dataOrLength;
      this.width = width;
      this.height = height;
    } else {
      this.width = dataOrLength;
      this.height = width;
      this.data = new Uint8ClampedArray(this.width * this.height * 4);
    }
  }
}

const ImageDataCtor = typeof ImageData !== 'undefined' ? ImageData : PolyfillImageData;

function makeImageData(width, height, fill = 0) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fill;
    data[i + 1] = fill;
    data[i + 2] = fill;
    data[i + 3] = 255;
  }
  return new ImageDataCtor(data, width, height);
}

describe('compareImageData', () => {
  it('identical images pass with 0 diff', () => {
    const a = makeImageData(2, 2, 100);
    const b = makeImageData(2, 2, 100);
    const result = compareImageData(a, b);
    expect(result.pass).toBe(true);
    expect(result.differentPixels).toBe(0);
    expect(result.differentPixelsRatio).toBe(0);
    expect(result.maxChannelDelta).toBe(0);
  });

  it('different images fail with non-zero diff', () => {
    const a = makeImageData(2, 2, 0);
    const b = makeImageData(2, 2, 100);
    const result = compareImageData(a, b);
    expect(result.pass).toBe(false);
    expect(result.differentPixels).toBe(4);
    expect(result.differentPixelsRatio).toBe(1);
    expect(result.maxChannelDelta).toBe(100);
  });

  it('size mismatch returns pass=false with reason', () => {
    const a = makeImageData(2, 2);
    const b = makeImageData(4, 4);
    const result = compareImageData(a, b);
    expect(result.pass).toBe(false);
    expect(result.reason).toBe('size mismatch');
    expect(result.differentPixels).toBe(-1);
  });

  it('tolerancePerChannel filters small diffs', () => {
    const a = makeImageData(1, 1);
    const b = new ImageDataCtor(new Uint8ClampedArray([10, 10, 10, 255]), 1, 1);
    const result = compareImageData(a, b, { tolerancePerChannel: 15 });
    expect(result.pass).toBe(true);
    expect(result.differentPixels).toBe(0);
    expect(result.maxChannelDelta).toBe(10);
  });

  it('maxDifferentPixelsRatio controls pass threshold', () => {
    const a = makeImageData(2, 2);
    const dataB = new Uint8ClampedArray([
      100, 100, 100, 255,
      0, 0, 0, 255,
      0, 0, 0, 255,
      0, 0, 0, 255,
    ]);
    const b = new ImageDataCtor(dataB, 2, 2);
    const result = compareImageData(a, b, { maxDifferentPixelsRatio: 0.2 });
    expect(result.pass).toBe(false);
    expect(result.differentPixels).toBe(1);
    expect(result.differentPixelsRatio).toBe(0.25);

    const result2 = compareImageData(a, b, { maxDifferentPixelsRatio: 0.3 });
    expect(result2.pass).toBe(true);
  });

  it('handles 1x1 images', () => {
    const a = makeImageData(1, 1, 50);
    const b = makeImageData(1, 1, 50);
    const result = compareImageData(a, b);
    expect(result.pass).toBe(true);
    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
  });
});
