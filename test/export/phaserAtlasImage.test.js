import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  decodePngDataUrl,
  composePageBlob,
  AbortError,
} from '../../packages/adapters/phaser-atlas/src/browserImage.js';

function setupBrowserMocks() {
  if (typeof globalThis.ImageData === 'undefined') {
    vi.stubGlobal('ImageData', class ImageData {
      constructor(data, w, h) { this.data = data; this.width = w; this.height = h; }
    });
  }
  const mockCtx = {
    drawImage: vi.fn(),
    clearRect: vi.fn(),
    getImageData: vi.fn(),
    putImageData: vi.fn(),
  };
  const mockCanvas = {
    getContext: vi.fn(() => mockCtx),
    width: 0,
    height: 0,
    convertToBlob: vi.fn(async () => new Blob([new Uint8Array([0x89, 0x50])], { type: 'image/png' })),
  };

  vi.stubGlobal('OffscreenCanvas', function (w, h) {
    mockCanvas.width = w;
    mockCanvas.height = h;
    return mockCanvas;
  });

  const mockBitmap = { width: 4, height: 4, close: vi.fn() };
  vi.stubGlobal('createImageBitmap', vi.fn(async () => mockBitmap));

  vi.stubGlobal('fetch', vi.fn(async () => ({
    blob: async () => new Blob([new Uint8Array(8)], { type: 'image/png' }),
  })));

  return { mockCtx, mockCanvas, mockBitmap };
}

describe('AbortError', () => {
  it('has name AbortError', () => {
    const e = new AbortError();
    expect(e.name).toBe('AbortError');
    expect(e.message).toBe('Aborted');
  });
});

describe('decodePngDataUrl', () => {
  let mocks;
  beforeEach(() => {
    mocks = setupBrowserMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('decodes dataUrl to RGBA using OffscreenCanvas', async () => {
    const rgba = new Uint8ClampedArray(4 * 4 * 4);
    rgba[3] = 255;
    mocks.mockCtx.getImageData.mockReturnValue({ data: rgba });

    const result = await decodePngDataUrl('data:image/png;base64,xxx');
    expect(result.width).toBe(4);
    expect(result.height).toBe(4);
    expect(result.rgba).toBe(rgba);
    expect(mocks.mockBitmap.close).toHaveBeenCalled();
  });

  it('throws AbortError if signal already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(decodePngDataUrl('data:x', controller.signal)).rejects.toThrow('Aborted');
  });

  it('closes bitmap even on getImageData error', async () => {
    mocks.mockCtx.getImageData.mockImplementation(() => { throw new Error('tainted'); });
    await expect(decodePngDataUrl('data:x')).rejects.toThrow('tainted');
    expect(mocks.mockBitmap.close).toHaveBeenCalled();
  });
});

describe('composePageBlob', () => {
  let mocks;
  beforeEach(() => {
    mocks = setupBrowserMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('composes sources onto page canvas and returns PNG blob', async () => {
    const rgba = new Uint8ClampedArray(8 * 8 * 4);
    const blob = await composePageBlob(64, 64, [
      { rgba, srcWidth: 8, crop: { x: 0, y: 0, w: 8, h: 8 }, dstX: 0, dstY: 0 },
    ]);
    expect(blob).toBeInstanceOf(Blob);
    expect(mocks.mockCtx.clearRect).toHaveBeenCalled();
    expect(mocks.mockCtx.drawImage).toHaveBeenCalled();
  });

  it('skips zero-size crops', async () => {
    const rgba = new Uint8ClampedArray(4 * 4 * 4);
    await composePageBlob(16, 16, [
      { rgba, srcWidth: 4, crop: { x: 0, y: 0, w: 0, h: 4 }, dstX: 0, dstY: 0 },
    ]);
    // drawImage not called because crop.w is 0
    expect(mocks.mockCtx.drawImage).not.toHaveBeenCalled();
  });

  it('throws AbortError on pre-aborted signal', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(composePageBlob(8, 8, [], controller.signal)).rejects.toThrow('Aborted');
  });
});
