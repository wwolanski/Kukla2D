import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { encodePngSequence, dataUrlToBlob, buildPngFilePath } from '@/features/export/infrastructure/encodePngSequence';

function makePngDataUrl() {
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
}

function makeFrame(overrides = {}) {
  return {
    animationId: 'anim-1',
    animationName: 'idle',
    frameIndex: 0,
    timeMs: 0,
    width: 100,
    height: 100,
    dataUrl: makePngDataUrl(),
    ...overrides,
  };
}

function makeArea(overrides = {}) {
  return {
    source: { x: 0, y: 0, width: 100, height: 100 },
    outputWidth: 100,
    outputHeight: 100,
    ...overrides,
  };
}

describe('dataUrlToBlob', () => {
  it('converts a data URL to a Blob with correct type', async () => {
    const blob = await dataUrlToBlob(makePngDataUrl());
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/png');
  });

  it('throws on invalid data URL', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => { throw new Error('Network error'); });

    await expect(dataUrlToBlob('data:bad')).rejects.toThrow('Network error');

    globalThis.fetch = originalFetch;
  });
});

describe('buildPngFilePath', () => {
  it('creates path with zero-padded frame index', () => {
    const { fileName, relativePath } = buildPngFilePath('walk', 'a-1', 0, new Map());
    expect(fileName).toBe('frame_0001.png');
    expect(relativePath).toBe('walk/frame_0001.png');
  });

  it('pads to 4 digits', () => {
    const r = buildPngFilePath('walk', 'a-1', 99, new Map());
    expect(r.fileName).toBe('frame_0100.png');
    const r2 = buildPngFilePath('walk', 'a-1', 999, new Map());
    expect(r2.fileName).toBe('frame_1000.png');
  });

  it('uses animation as directory name', () => {
    const { relativePath } = buildPngFilePath('run', 'a-1', 0, new Map());
    expect(relativePath).toBe('run/frame_0001.png');
  });

  it('appends ID suffix on collision', () => {
    const usedNames = new Map();
    usedNames.set('idle', 'anim-1');

    const r = buildPngFilePath('idle', 'anim-2', 0, usedNames);
    expect(r.relativePath).toBe('idle_anim-2/frame_0001.png');
  });

  it('sanitizes an untrusted animation ID used as collision suffix', () => {
    const usedNames = new Map([['idle', 'anim-1']]);
    const r = buildPngFilePath('idle', '../anim/2', 0, usedNames);
    expect(r.relativePath).toBe('idle_anim_2/frame_0001.png');
    expect(r.relativePath).not.toContain('..');
  });

  it('does not append suffix when same ID requests same name', () => {
    const usedNames = new Map();
    usedNames.set('idle', 'anim-1');

    const r = buildPngFilePath('idle', 'anim-1', 1, usedNames);
    expect(r.relativePath).toBe('idle/frame_0002.png');
  });

  it('falls back to animation for empty name', () => {
    const { relativePath } = buildPngFilePath('', 'a-1', 0, new Map());
    expect(relativePath).toMatch(/^animation\//);
  });

  it('handles multiple colliding animations with distinct IDs', () => {
    const usedNames = new Map();
    const r1 = buildPngFilePath('walk', 'a-1', 0, usedNames);
    expect(r1.relativePath).toBe('walk/frame_0001.png');

    const r2 = buildPngFilePath('walk', 'a-2', 0, usedNames);
    expect(r2.relativePath).toBe('walk_a-2/frame_0001.png');

    const r3 = buildPngFilePath('walk', 'a-3', 0, usedNames);
    expect(r3.relativePath).toBe('walk_a-3/frame_0001.png');
  });
});

describe('encodePngSequence', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns empty array for empty frames', async () => {
    const result = await encodePngSequence({ frames: [], area: makeArea() });
    expect(result).toEqual([]);
  });

  it('converts single frame to one artifact', async () => {
    const frames = [makeFrame()];
    const result = await encodePngSequence({ frames, area: makeArea(), animationName: 'idle' });

    expect(result).toHaveLength(1);
    expect(result[0].fileName).toBe('frame_0001.png');
    expect(result[0].mimeType).toBe('image/png');
    expect(result[0].blob).toBeInstanceOf(Blob);
    expect(result[0].relativePath).toBe('idle/frame_0001.png');
  });

  it('generates sequential filenames', async () => {
    const frames = [
      makeFrame({ frameIndex: 0 }),
      makeFrame({ frameIndex: 1 }),
      makeFrame({ frameIndex: 2 }),
    ];
    const result = await encodePngSequence({ frames, area: makeArea(), animationName: 'idle' });

    expect(result).toHaveLength(3);
    expect(result[0].fileName).toBe('frame_0001.png');
    expect(result[1].fileName).toBe('frame_0002.png');
    expect(result[2].fileName).toBe('frame_0003.png');
  });

  it('throws on dimension mismatch', async () => {
    const frames = [makeFrame({ width: 200, height: 100 })];

    await expect(
      encodePngSequence({ frames, area: makeArea({ outputWidth: 100, outputHeight: 100 }), animationName: 'idle' })
    ).rejects.toThrow('dimensions 200x100 do not match plan 100x100');
  });

  it('throws on non-PNG blob', async () => {
    globalThis.fetch = vi.fn(async () => ({
      blob: async () => new Blob(['not-png'], { type: 'text/plain' }),
    }));

    const frames = [makeFrame({ dataUrl: 'data:text/plain,not-png' })];
    await expect(
      encodePngSequence({ frames, area: makeArea(), animationName: 'idle' })
    ).rejects.toThrow('not a valid PNG');
  });

  it('handles animation name collision with ID suffix', async () => {
    const frames = [
      makeFrame({ animationId: 'a-1', animationName: 'my anim', frameIndex: 0 }),
      makeFrame({ animationId: 'a-2', animationName: 'my anim', frameIndex: 1 }),
    ];

    const result = await encodePngSequence({ frames, area: makeArea(), animationName: 'my_anim' });

    expect(result).toHaveLength(2);
    expect(result[0].relativePath).toMatch(/^my_anim\//);
    expect(result[1].relativePath).toMatch(/^my_anim_a-2\//);
  });

  it('all frames have correct artifact shape', async () => {
    const frames = [makeFrame({ frameIndex: 0 }), makeFrame({ frameIndex: 1 })];
    const result = await encodePngSequence({ frames, area: makeArea(), animationName: 'idle' });

    for (const art of result) {
      expect(art).toHaveProperty('fileName');
      expect(art).toHaveProperty('mimeType', 'image/png');
      expect(art).toHaveProperty('blob');
      expect(art).toHaveProperty('relativePath');
    }
  });

  it('preserves correct blob type from data URL', async () => {
    const frames = [makeFrame()];
    const result = await encodePngSequence({ frames, area: makeArea(), animationName: 'idle' });

    expect(result[0].blob.type).toBe('image/png');
  });
});
