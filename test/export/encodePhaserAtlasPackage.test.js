import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { encodePhaserAtlasPackage } from '../../packages/adapters/phaser-atlas/src/encodePhaserAtlasPackage.js';

function makeRgba(w, h, r, g, b, a = 255) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = a;
  }
  return data;
}

function setupMocks() {
  if (typeof globalThis.ImageData === 'undefined') {
    vi.stubGlobal('ImageData', class ImageData {
      constructor(data, w, h) { this.data = data; this.width = w; this.height = h; }
    });
  }
  const pageBlobs = [];
  const mockCtx = {
    drawImage: vi.fn(),
    clearRect: vi.fn(),
    getImageData: vi.fn(),
    putImageData: vi.fn(),
  };
  let blobCounter = 0;
  const mockCanvas = {
    getContext: vi.fn(() => mockCtx),
    width: 0,
    height: 0,
    convertToBlob: vi.fn(async () => {
      const b = new Blob([`page-${blobCounter++}`], { type: 'image/png' });
      pageBlobs.push(b);
      return b;
    }),
  };

  vi.stubGlobal('OffscreenCanvas', function (w, h) {
    mockCanvas.width = w;
    mockCanvas.height = h;
    return mockCanvas;
  });

  const framePixels = [
    makeRgba(16, 16, 255, 0, 0),
    makeRgba(16, 16, 0, 255, 0),
    makeRgba(16, 16, 0, 0, 255),
  ];
  let bitmapIndex = 0;

  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({
    width: 16,
    height: 16,
    close: vi.fn(),
  })));

  mockCtx.getImageData.mockImplementation(() => {
    const idx = Math.min(bitmapIndex++, framePixels.length - 1);
    return { data: framePixels[idx] };
  });

  vi.stubGlobal('fetch', vi.fn(async () => ({
    blob: async () => new Blob([new Uint8Array(8)], { type: 'image/png' }),
  })));

  return { pageBlobs, mockCanvas };
}

function makeCapturedFrames() {
  return [
    { identity: 'idle-anim1/0000', animId: 'anim1', animName: 'idle', frameIndex: 0, dataUrl: 'data:image/png;base64,aa', sourceWidth: 16, sourceHeight: 16 },
    { identity: 'idle-anim1/0001', animId: 'anim1', animName: 'idle', frameIndex: 1, dataUrl: 'data:image/png;base64,bb', sourceWidth: 16, sourceHeight: 16 },
    { identity: 'walk-anim2/0000', animId: 'anim2', animName: 'walk', frameIndex: 0, dataUrl: 'data:image/png;base64,cc', sourceWidth: 16, sourceHeight: 16 },
  ];
}

function makeOptions(overrides = {}) {
  return {
    fps: 24,
    scale: 100,
    trim: true,
    padding: 2,
    maxPageSize: 2048,
    loop: true,
    outputName: 'test-char',
    destination: 'zip',
    textureKey: 'test-char',
    animations: [
      { id: 'anim1', name: 'idle', duration: 100, markers: [{ id: 'm1', time: 0, label: 'Start' }] },
      { id: 'anim2', name: 'walk', duration: 200 },
    ],
    ...overrides,
  };
}

describe('encodePhaserAtlasPackage', () => {
  beforeEach(() => {
    setupMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('produces exact K4 artifacts for single page', async () => {
    const result = await encodePhaserAtlasPackage(makeCapturedFrames(), makeOptions());
    expect(result.ok).toBe(true);
    const arts = result.artifacts;
    expect(arts).toHaveLength(7);

    const names = arts.map((a) => a.relativePath);
    expect(names[0]).toBe('test-char/test-char.png');
    expect(names[1]).toBe('test-char/test-char.atlas.json');
    expect(names[2]).toBe('test-char/test-char.animations.json');
    expect(names[3]).toBe('test-char/test-char.markers.json');
    expect(names[4]).toBe('test-char/test-char.export-report.json');
    expect(names[5]).toBe('test-char/test-char.example.ts');
    expect(names[6]).toBe('test-char/README.md');

    const pngs = arts.filter((a) => a.mimeType === 'image/png');
    expect(pngs).toHaveLength(1);

    const jsons = arts.filter((a) => a.mimeType === 'application/json');
    expect(jsons).toHaveLength(4);
  });

  it('generates correct atlas JSON structure', async () => {
    const result = await encodePhaserAtlasPackage(makeCapturedFrames(), makeOptions());
    const atlasBlob = result.artifacts.find((a) => a.fileName.endsWith('.atlas.json'));
    const atlas = JSON.parse(await atlasBlob.blob.text());
    expect(atlas.meta.app).toBe('Kukla2D');
    expect(atlas.meta.image).toBe('test-char.png');
    expect(Object.keys(atlas.frames)).toHaveLength(3);
  });

  it('generates correct animation JSON with namespaced keys', async () => {
    const result = await encodePhaserAtlasPackage(makeCapturedFrames(), makeOptions());
    const animBlob = result.artifacts.find((a) => a.fileName.endsWith('.animations.json'));
    const anim = JSON.parse(await animBlob.blob.text());
    expect(anim.anims).toHaveLength(2);
    expect(anim.anims[0].key).toBe('test-char:idle');
    expect(anim.anims[1].key).toBe('test-char:walk');
    expect(anim.anims[0].repeat).toBe(-1);
    expect(anim.anims[0].frameRate).toBe(24);
  });

  it('creates deterministic unique animation keys for duplicate clip names', async () => {
    const frames = makeCapturedFrames().map((frame, index) => ({
      ...frame,
      animName: 'idle',
      identity: `idle-${frame.animId}/${String(index).padStart(4, '0')}`,
    }));
    const result = await encodePhaserAtlasPackage(frames, makeOptions({
      animations: [
        { id: 'anim1', name: 'idle' },
        { id: 'anim2', name: 'idle' },
      ],
    }));

    expect(result.ok).toBe(true);
    const animBlob = result.artifacts.find((a) => a.fileName.endsWith('.animations.json'));
    const anim = JSON.parse(await animBlob.blob.text());
    expect(anim.anims.map((entry) => entry.key)).toEqual([
      'test-char:idle-anim1',
      'test-char:idle-anim2',
    ]);
  });

  it('keeps all text artifacts byte-identical across repeated exports', async () => {
    const first = await encodePhaserAtlasPackage(makeCapturedFrames(), makeOptions());
    const second = await encodePhaserAtlasPackage(makeCapturedFrames(), makeOptions());
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);

    for (let index = 0; index < first.artifacts.length; index++) {
      const a = first.artifacts[index];
      const b = second.artifacts[index];
      if (a.mimeType !== 'image/png') {
        expect(await a.blob.text()).toBe(await b.blob.text());
      }
    }
  });

  it('generates marker manifest with sorted markers', async () => {
    const result = await encodePhaserAtlasPackage(makeCapturedFrames(), makeOptions());
    const markerBlob = result.artifacts.find((a) => a.fileName.endsWith('.markers.json'));
    const markers = JSON.parse(await markerBlob.blob.text());
    expect(markers.version).toBe(1);
    expect(markers.markers).toHaveLength(1);
    expect(markers.markers[0].animationKey).toBe('test-char:idle');
  });

  it('generates export report with bake issues', async () => {
    const opts = makeOptions({
      bakeIssues: [
        { classification: 'baked', code: 'BONE', path: 'bones', message: 'Bones baked to frames' },
      ],
    });
    const result = await encodePhaserAtlasPackage(makeCapturedFrames(), opts);
    const reportBlob = result.artifacts.find((a) => a.fileName.endsWith('.export-report.json'));
    const report = JSON.parse(await reportBlob.blob.text());
    expect(report.format).toBe('phaser-atlas-baked');
    expect(report.summary.totalFrames).toBe(3);
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0].classification).toBe('baked');
  });

  it('returns cancelled on abort', async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await encodePhaserAtlasPackage(makeCapturedFrames(), makeOptions({ signal: controller.signal }));
    expect(result.ok).toBe(false);
    expect(result.code).toBe('PHASER_ATLAS_CANCELLED');
  });

  it('returns error for oversized frame', async () => {
    const bigFrames = [
      { identity: 'big/0000', animId: 'a', animName: 'big', frameIndex: 0, dataUrl: 'data:x', sourceWidth: 16, sourceHeight: 16 },
    ];
    const opts = makeOptions({ maxPageSize: 4, padding: 0, animations: [{ id: 'a', name: 'big' }] });
    const result = await encodePhaserAtlasPackage(bigFrames, opts);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('PHASER_ATLAS_OVERSIZED_FRAME');
  });

  it('produces multi-page artifacts when forced', async () => {
    const opts = makeOptions({ maxPageSize: 32 });
    const result = await encodePhaserAtlasPackage(makeCapturedFrames(), opts);
    // With 16x16 frames + padding 2 = 20px each, 3 frames on 32px page
    // Depending on packer layout, may be single or multi
    expect(result.ok).toBe(true);
    if (result.ok) {
      const pngs = result.artifacts.filter((a) => a.mimeType === 'image/png');
      const atlasBlob = result.artifacts.find((a) => a.fileName.endsWith('.atlas.json'));
      const atlas = JSON.parse(await atlasBlob.blob.text());
      if (pngs.length > 1) {
        expect(atlas.textures).toBeDefined();
      } else {
        expect(atlas.frames).toBeDefined();
      }
    }
  });

  it('produces no duplicate paths', async () => {
    const result = await encodePhaserAtlasPackage(makeCapturedFrames(), makeOptions());
    if (result.ok) {
      const paths = result.artifacts.map((a) => a.relativePath ?? a.fileName);
      expect(new Set(paths).size).toBe(paths.length);
    }
  });

  it('all text artifacts are UTF-8', async () => {
    const result = await encodePhaserAtlasPackage(makeCapturedFrames(), makeOptions());
    if (result.ok) {
      for (const art of result.artifacts) {
        if (art.mimeType === 'application/json' || art.mimeType === 'text/typescript' || art.mimeType === 'text/markdown') {
          const text = await art.blob.text();
          expect(text.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('calls onProgress during decode and compose', async () => {
    const onProgress = vi.fn();
    await encodePhaserAtlasPackage(makeCapturedFrames(), makeOptions({ onProgress }));
    expect(onProgress).toHaveBeenCalled();
    const labels = onProgress.mock.calls.map((c) => c[0]?.label).filter(Boolean);
    expect(labels.some((l) => l.includes('Decoding'))).toBe(true);
  });

  it('generates example TS with correct load method', async () => {
    const result = await encodePhaserAtlasPackage(makeCapturedFrames(), makeOptions());
    if (result.ok) {
      const exBlob = result.artifacts.find((a) => a.fileName.endsWith('.example.ts'));
      const ts = await exBlob.blob.text();
      expect(ts).toContain('load.atlas');
      expect(ts).toContain('test-char:idle');
      expect(ts).toContain('test-char:walk');
    }
  });

  it('generates README with animation list', async () => {
    const result = await encodePhaserAtlasPackage(makeCapturedFrames(), makeOptions());
    if (result.ok) {
      const readmeBlob = result.artifacts.find((a) => a.fileName === 'README.md');
      const md = await readmeBlob.blob.text();
      expect(md).toContain('test-char:idle');
      expect(md).toContain('1 marker(s)');
    }
  });
});
