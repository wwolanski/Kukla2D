import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { encodeGif } from '@/features/export/infrastructure/encodeGif';

function makeRgbaData(width, height, fillR, fillG, fillB, fillA = 255) {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fillR;
    data[i + 1] = fillG;
    data[i + 2] = fillB;
    data[i + 3] = fillA;
  }
  return data;
}

function makeAlphaRgba(width, height) {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = 255;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = (x < width / 2) ? 255 : 0;
    }
  }
  return data;
}

function makeFrame(overrides = {}) {
  return {
    animationId: 'anim-1',
    animationName: 'idle',
    frameIndex: 0,
    timeMs: 0,
    width: 2,
    height: 2,
    dataUrl: 'data:image/png;base64,test',
    ...overrides,
  };
}

function makeArea(overrides = {}) {
  return {
    source: { x: 0, y: 0, width: 2, height: 2 },
    outputWidth: 2,
    outputHeight: 2,
    ...overrides,
  };
}

function readUint16LE(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function findSequence(bytes, seq) {
  for (let i = 0; i <= bytes.length - seq.length; i++) {
    let match = true;
    for (let j = 0; j < seq.length; j++) {
      if (bytes[i + j] !== seq[j]) { match = false; break; }
    }
    if (match) return i;
  }
  return -1;
}

function countImageDescriptors(bytes) {
  let count = 0;
  let pos = 0;
  let idx = findSequence(bytes.slice(pos), [0x2C]);
  while (idx >= 0) {
    count++;
    pos += idx + 1;
    idx = findSequence(bytes.slice(pos), [0x2C]);
  }
  return count;
}

function findGceBlocks(bytes) {
  const blocks = [];
  let pos = 0;
  while (true) {
    const idx = findSequence(bytes.slice(pos), [0x21, 0xF9]);
    if (idx < 0) break;
    const absPos = pos + idx;
    const packed = bytes[absPos + 3];
    const delay = readUint16LE(bytes, absPos + 4);
    const transparent = (packed & 1) === 1;
    blocks.push({ absPos, transparent, delay });
    pos = absPos + 2 + 4 + 1;
  }
  return blocks;
}

function findNetscapeExtension(bytes) {
  const idx = findSequence(bytes, [
    0x21, 0xFF, 0x0B,
    0x4E, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, 0x32, 0x2E, 0x30,
  ]);
  if (idx < 0) return null;
  const loopCount = readUint16LE(bytes, idx + 16);
  return { loopCount };
}

describe('encodeGif', () => {
  let currentRgbaData;
  let currentWidth;
  let currentHeight;

  beforeEach(() => {
    currentRgbaData = makeRgbaData(2, 2, 255, 255, 255);
    currentWidth = 2;
    currentHeight = 2;

    vi.stubGlobal('fetch', async () => ({
      blob: async () => new Blob(['fake-png'], { type: 'image/png' }),
    }));

    vi.stubGlobal('createImageBitmap', async () => ({
      width: currentWidth,
      height: currentHeight,
      close: () => {},
    }));

    class MockOffscreenCanvas {
      constructor(w, h) { this._w = w; this._h = h; }
      getContext() {
        return {
          drawImage: () => {},
          getImageData: () => ({
            data: currentRgbaData,
            width: this._w,
            height: this._h,
          }),
        };
      }
    }
    vi.stubGlobal('OffscreenCanvas', MockOffscreenCanvas);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function setRgbaResponse(data, width, height) {
    currentRgbaData = data;
    currentWidth = width;
    currentHeight = height;
  }

  it('returns empty array for empty frames', async () => {
    const result = await encodeGif({ frames: [], area: makeArea() });
    expect(result).toEqual([]);
  });

  it('creates a GIF with GIF89a signature', async () => {
    setRgbaResponse(makeRgbaData(2, 2, 255, 0, 0), 2, 2);
    const result = await encodeGif({
      frames: [makeFrame()],
      area: makeArea(),
      fps: 10,
      background: { enabled: false },
      animationName: 'idle',
    });

    expect(result).toHaveLength(1);
    expect(result[0].fileName).toBe('idle.gif');
    expect(result[0].mimeType).toBe('image/gif');
    expect(result[0].blob).toBeInstanceOf(Blob);

    const bytes = new Uint8Array(await result[0].blob.arrayBuffer());
    const header = new TextDecoder().decode(bytes.slice(0, 6));
    expect(header).toBe('GIF89a');
  });

  it('sets logical dimensions from plan area', async () => {
    setRgbaResponse(makeRgbaData(4, 8, 0, 255, 0), 4, 8);
    const result = await encodeGif({
      frames: [makeFrame({ width: 4, height: 8 })],
      area: makeArea({ outputWidth: 4, outputHeight: 8 }),
      fps: 10,
      background: { enabled: false },
      animationName: 'dims',
    });

    const bytes = new Uint8Array(await result[0].blob.arrayBuffer());
    expect(readUint16LE(bytes, 6)).toBe(4);
    expect(readUint16LE(bytes, 8)).toBe(8);
  });

  it('encodes correct number of frames', async () => {
    setRgbaResponse(makeRgbaData(2, 2, 255, 0, 0), 2, 2);

    const result = await encodeGif({
      frames: [makeFrame({ frameIndex: 0 }), makeFrame({ frameIndex: 1 }), makeFrame({ frameIndex: 2 })],
      area: makeArea(),
      fps: 10,
      background: { enabled: false },
      animationName: 'multi',
    });

    const bytes = new Uint8Array(await result[0].blob.arrayBuffer());
    expect(countImageDescriptors(bytes)).toBe(3);
  });

  it('sets frame delay based on 10fps', async () => {
    setRgbaResponse(makeRgbaData(2, 2, 255, 0, 0), 2, 2);
    const result = await encodeGif({
      frames: [makeFrame({ frameIndex: 0 }), makeFrame({ frameIndex: 1 })],
      area: makeArea(),
      fps: 10,
      background: { enabled: false },
      animationName: 'delay',
    });

    const bytes = new Uint8Array(await result[0].blob.arrayBuffer());
    const blocks = findGceBlocks(bytes);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].delay).toBe(10);
    expect(blocks[1].delay).toBe(10);
  });

  it('includes Netscape loop extension with repeat 0', async () => {
    setRgbaResponse(makeRgbaData(2, 2, 255, 0, 0), 2, 2);
    const result = await encodeGif({
      frames: [makeFrame()],
      area: makeArea(),
      fps: 10,
      background: { enabled: false },
      animationName: 'loop',
    });

    const bytes = new Uint8Array(await result[0].blob.arrayBuffer());
    const ext = findNetscapeExtension(bytes);
    expect(ext).not.toBeNull();
    expect(ext.loopCount).toBe(0);
  });

  it('marks transparency flag for transparent background', async () => {
    setRgbaResponse(makeAlphaRgba(2, 2), 2, 2);
    const result = await encodeGif({
      frames: [makeFrame()],
      area: makeArea(),
      fps: 10,
      background: { enabled: false },
      animationName: 'alpha',
    });

    const bytes = new Uint8Array(await result[0].blob.arrayBuffer());
    const blocks = findGceBlocks(bytes);
    expect(blocks[0].transparent).toBe(true);
  });

  it('omits transparency flag for custom background', async () => {
    setRgbaResponse(makeAlphaRgba(2, 2), 2, 2);
    const result = await encodeGif({
      frames: [makeFrame()],
      area: makeArea(),
      fps: 10,
      background: { enabled: true, color: '#ffffff' },
      animationName: 'bg',
    });

    const bytes = new Uint8Array(await result[0].blob.arrayBuffer());
    const blocks = findGceBlocks(bytes);
    expect(blocks[0].transparent).toBe(false);
  });

  it('throws on dimension mismatch', async () => {
    setRgbaResponse(makeRgbaData(2, 2, 255, 0, 0), 2, 2);
    await expect(
      encodeGif({
        frames: [makeFrame({ width: 200, height: 100 })],
        area: makeArea({ outputWidth: 100, outputHeight: 100 }),
        fps: 10,
        background: { enabled: false },
        animationName: 'err',
      })
    ).rejects.toThrow('dimensions 200x100 do not match plan 100x100');
  });

  it('handles abort signal', async () => {
    const controller = new AbortController();
    controller.abort();
    setRgbaResponse(makeRgbaData(2, 2, 255, 0, 0), 2, 2);
    const result = await encodeGif({
      frames: [makeFrame()],
      area: makeArea(),
      fps: 10,
      background: { enabled: false },
      animationName: 'abort',
      signal: controller.signal,
    });
    expect(result).toEqual([]);
  });

  it('does not retain naming state between encoder calls', async () => {
    setRgbaResponse(makeRgbaData(2, 2, 255, 0, 0), 2, 2);
    const r1 = await encodeGif({
      frames: [makeFrame({ animationId: 'a-1' })],
      area: makeArea(), fps: 10,
      background: { enabled: false },
      animationName: 'anim_x',
    });

    setRgbaResponse(makeRgbaData(2, 2, 255, 0, 0), 2, 2);
    const r2 = await encodeGif({
      frames: [makeFrame({ animationId: 'a-2' })],
      area: makeArea(), fps: 10,
      background: { enabled: false },
      animationName: 'anim_x',
    });

    expect(r1[0].fileName).toBe('anim_x.gif');
    expect(r2[0].fileName).toBe('anim_x.gif');
  });

  it('creates artifact with correct shape', async () => {
    setRgbaResponse(makeRgbaData(2, 2, 255, 0, 0), 2, 2);
    const result = await encodeGif({
      frames: [makeFrame()],
      area: makeArea(),
      fps: 10,
      background: { enabled: false },
      animationName: 'shape',
    });

    expect(result[0]).toMatchObject({
      fileName: 'shape.gif',
      mimeType: 'image/gif',
      relativePath: 'shape.gif',
    });
    expect(result[0].blob.type).toBe('image/gif');
  });

  it('sanitizes names with special characters', async () => {
    setRgbaResponse(makeRgbaData(2, 2, 0, 0, 255), 2, 2);
    const result = await encodeGif({
      frames: [makeFrame()],
      area: makeArea(),
      fps: 10,
      background: { enabled: false },
      animationName: 'my animation!',
    });
    expect(result[0].fileName).toBe('my_animation_.gif');
  });

  it('reports progress per frame', async () => {
    setRgbaResponse(makeRgbaData(2, 2, 255, 0, 0), 2, 2);
    const calls = [];
    await encodeGif({
      frames: [makeFrame({ frameIndex: 0 }), makeFrame({ frameIndex: 1 })],
      area: makeArea(), fps: 10,
      background: { enabled: false },
      animationName: 'prog',
      onProgress: p => calls.push({ ...p }),
    });
    expect(calls).toHaveLength(2);
    expect(calls[0].current).toBe(0);
    expect(calls[1].current).toBe(1);
  });
});
