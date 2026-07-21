// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { captureCanvasDataUrl, captureThumbnail, imageDataToDataUrl } from '@/features/canvas/infrastructure/captureAdapter.js';

function makeCanvas(w = 100, h = 100) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Mock 2D context + toDataURL since jsdom canvas does not provide real 2D rendering
function installMockContext() {
  HTMLCanvasElement.prototype.getContext = function (kind) {
    if (kind === '2d') {
      return {
        fillStyle: '',
        drawImage: () => {},
        fillRect: () => {},
        putImageData: () => {},
        getImageData: (x, y, w2, h2) => ({ data: new Uint8ClampedArray(w2 * h2 * 4), width: w2, height: h2 }),
      };
    }
    return null;
  };
  HTMLCanvasElement.prototype.toDataURL = function (type) {
    if (type && type.startsWith('image/webp')) {
      return 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=';
    }
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  };
}

describe('captureAdapter', () => {
  beforeAll(installMockContext);

  it('captureCanvasDataUrl returns data URL with default format', () => {
    const url = captureCanvasDataUrl(makeCanvas());
    expect(url.startsWith('data:image/png')).toBe(true);
  });

  it('captureCanvasDataUrl applies bgEnabled + bgColor when same size', () => {
    const url = captureCanvasDataUrl(makeCanvas(), { bgEnabled: true, bgColor: '#00ff00' });
    expect(url.startsWith('data:image/png')).toBe(true);
  });

  it('captureCanvasDataUrl resizes to explicit width/height', () => {
    const url = captureCanvasDataUrl(makeCanvas(100, 100), { width: 200, height: 150, bgEnabled: true, bgColor: '#000' });
    expect(url).toMatch(/^data:image\/png/);
  });

  it('captureThumbnail produces webp by default with reduced size', () => {
    const url = captureThumbnail(makeCanvas(800, 600), { maxWidth: 400 });
    expect(url.startsWith('data:image/webp')).toBe(true);
  });
});

describe('imageDataToDataUrl', () => {
  beforeAll(() => {
    installMockContext();
    if (typeof globalThis.ImageData === 'undefined') {
      globalThis.ImageData = class ImageData {
        constructor(dataOrLength, width, height) {
          if (dataOrLength instanceof Uint8ClampedArray) {
            this.data = dataOrLength;
            this.width = width;
            this.height = height;
          } else {
            this.data = new Uint8ClampedArray(dataOrLength * 4);
            this.width = width;
            this.height = height;
          }
        }
      };
    }
  });

  it('converts ImageData to data URL', () => {
    const imageData = new ImageData(new Uint8ClampedArray(4 * 2 * 2), 2, 2);
    const url = imageDataToDataUrl(imageData);
    expect(url.startsWith('data:image/png')).toBe(true);
  });

  it('respects format and quality options', () => {
    const imageData = new ImageData(new Uint8ClampedArray(4 * 2 * 2), 2, 2);
    const url = imageDataToDataUrl(imageData, { format: 'image/webp', quality: 0.5 });
    expect(url.startsWith('data:image/webp')).toBe(true);
  });

  it('returns string even with bgEnabled', () => {
    const imageData = new ImageData(new Uint8ClampedArray(4 * 1 * 1), 1, 1);
    const url = imageDataToDataUrl(imageData, { bgEnabled: true, bgColor: '#ff0000' });
    expect(typeof url).toBe('string');
    expect(url.startsWith('data:image/')).toBe(true);
  });
});
