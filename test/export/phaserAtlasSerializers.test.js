import { describe, expect, it } from 'vitest';
import {
  buildSingleAtlasJson,
  buildMultiAtlasJson,
} from '../../packages/adapters/phaser-atlas/src/phaserAtlasJson.js';
import {
  buildAnimationJson,
  buildMarkerManifest,
} from '../../packages/adapters/phaser-atlas/src/phaserAnimationJson.js';
import {
  buildExportReport,
  buildExampleTs,
  buildReadme,
} from '../../packages/adapters/phaser-atlas/src/phaserPackageDocs.js';

describe('buildSingleAtlasJson', () => {
  it('produces Hash-format frames object', () => {
    const page = {
      width: 64,
      height: 40,
      regions: [
        {
          name: 'idle/0000',
          frame: { x: 0, y: 0, w: 32, h: 32 },
          rotated: false,
          trimmed: false,
          spriteSourceSize: { x: 0, y: 0, w: 32, h: 32 },
          sourceSize: { w: 32, h: 32 },
          pageIndex: 0,
        },
        {
          name: 'idle/0001',
          frame: { x: 32, y: 0, w: 24, h: 40 },
          rotated: false,
          trimmed: true,
          spriteSourceSize: { x: 4, y: 2, w: 24, h: 40 },
          sourceSize: { w: 32, h: 44 },
          pageIndex: 0,
        },
      ],
    };
    const json = buildSingleAtlasJson(page, 'page.png', '1');
    expect(json.meta.app).toBe('Kukla2D');
    expect(json.meta.image).toBe('page.png');
    expect(json.meta.format).toBe('RGBA8888');
    expect(json.meta.scale).toBe('1');
    expect(Object.keys(json.frames)).toEqual(['idle/0000', 'idle/0001']);
    expect(json.frames['idle/0000'].rotated).toBe(false);
    expect(json.frames['idle/0001'].trimmed).toBe(true);
    expect(json.frames['idle/0001'].spriteSourceSize).toEqual({ x: 4, y: 2, w: 24, h: 40 });
  });
});

describe('buildMultiAtlasJson', () => {
  it('produces textures array with per-page frames using filename', () => {
    const pages = [
      {
        width: 64,
        height: 32,
        regions: [
          {
            name: 'walk/0000',
            frame: { x: 0, y: 0, w: 32, h: 32 },
            rotated: false,
            trimmed: false,
            spriteSourceSize: { x: 0, y: 0, w: 32, h: 32 },
            sourceSize: { w: 32, h: 32 },
            pageIndex: 0,
          },
        ],
      },
      {
        width: 24,
        height: 40,
        regions: [
          {
            name: 'walk/0001',
            frame: { x: 0, y: 0, w: 24, h: 40 },
            rotated: false,
            trimmed: false,
            spriteSourceSize: { x: 0, y: 0, w: 24, h: 40 },
            sourceSize: { w: 24, h: 40 },
            pageIndex: 1,
          },
        ],
      },
    ];
    const json = buildMultiAtlasJson(pages, ['p-0.png', 'p-1.png'], '1');
    expect(json.textures).toHaveLength(2);
    expect(json.textures[0].image).toBe('p-0.png');
    expect(json.textures[0].frames[0].filename).toBe('walk/0000');
    expect(json.textures[1].image).toBe('p-1.png');
    expect(json.textures[1].frames[0].filename).toBe('walk/0001');
    expect(json.meta.app).toBe('Kukla2D');
  });

  it('uses correct scale string', () => {
    const pages = [{ width: 10, height: 10, regions: [] }];
    const json = buildMultiAtlasJson(pages, ['p.png'], '0.5');
    expect(json.meta.scale).toBe('0.5');
  });
});

describe('buildAnimationJson', () => {
  it('builds anims array with namespaced keys', () => {
    const anims = [
      {
        animId: 'a1',
        animName: 'idle',
        animationKey: 'char:idle',
        textureKey: 'char',
        frameNames: ['idle/0000', 'idle/0001'],
        fps: 24,
        repeat: -1,
      },
    ];
    const json = buildAnimationJson(anims);
    expect(json.anims).toHaveLength(1);
    expect(json.anims[0].key).toBe('char:idle');
    expect(json.anims[0].type).toBe('frame');
    expect(json.anims[0].frameRate).toBe(24);
    expect(json.anims[0].repeat).toBe(-1);
    expect(json.anims[0].frames).toEqual([
      { key: 'char', frame: 'idle/0000', duration: 0 },
      { key: 'char', frame: 'idle/0001', duration: 0 },
    ]);
    expect(json.globalTimeScale).toBe(1);
  });

  it('throws on duplicate animation key', () => {
    const anims = [
      { animId: 'a1', animName: 'idle', animationKey: 'x:idle', textureKey: 'x', frameNames: [], fps: 10, repeat: 0 },
      { animId: 'a2', animName: 'idle2', animationKey: 'x:idle', textureKey: 'x', frameNames: [], fps: 10, repeat: 0 },
    ];
    expect(() => buildAnimationJson(anims)).toThrow('Duplicate animation key: x:idle');
  });

  it('orders frames by frameNames array order', () => {
    const anims = [
      {
        animId: 'a1',
        animName: 'walk',
        animationKey: 'c:walk',
        textureKey: 'c',
        frameNames: ['walk/0002', 'walk/0000', 'walk/0001'],
        fps: 12,
        repeat: 0,
      },
    ];
    const json = buildAnimationJson(anims);
    expect(json.anims[0].frames.map((f) => f.frame)).toEqual([
      'walk/0002', 'walk/0000', 'walk/0001',
    ]);
  });
});

describe('buildMarkerManifest', () => {
  it('collects markers sorted by time then id', () => {
    const anims = [
      {
        animId: 'a1',
        animName: 'idle',
        animationKey: 'c:idle',
        textureKey: 'c',
        frameNames: [],
        fps: 10,
        repeat: 0,
        markers: [
          { id: 'm2', time: 500, label: 'Mid' },
          { id: 'm1', time: 0, label: 'Start' },
          { id: 'm3', time: 500, label: 'AlsoMid' },
        ],
      },
    ];
    const manifest = buildMarkerManifest(anims);
    expect(manifest.version).toBe(1);
    expect(manifest.markers).toHaveLength(3);
    expect(manifest.markers.map((m) => m.id)).toEqual(['m1', 'm2', 'm3']);
    expect(manifest.markers[0].animationKey).toBe('c:idle');
  });

  it('returns empty markers for anims without markers', () => {
    const anims = [
      { animId: 'a1', animName: 'x', animationKey: 'c:x', textureKey: 'c', frameNames: [], fps: 10, repeat: 0 },
    ];
    expect(buildMarkerManifest(anims).markers).toHaveLength(0);
  });
});

describe('buildExportReport', () => {
  it('produces report with format, options, summary and issues', () => {
    const report = buildExportReport({
      fps: 24, scale: 100, trim: true, padding: 2, maxPageSize: 2048,
      loop: true, repeat: -1, destination: 'zip',
      pageCount: 2, totalFrames: 10, animationCount: 2, markerCount: 3,
      issues: [
        { classification: 'baked', code: 'BONE', path: 'bones', message: 'Bones baked' },
      ],
    });
    expect(report.format).toBe('phaser-atlas-baked');
    expect(report.version).toBe('1');
    expect(report).not.toHaveProperty('timestamp');
    expect(report.options.repeat).toBe(-1);
    expect(report.summary.pages).toBe(2);
    expect(report.summary.totalFrames).toBe(10);
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0].classification).toBe('baked');
  });

  it('defaults issues to empty array', () => {
    const report = buildExportReport({
      fps: 10, scale: 100, trim: false, padding: 0, maxPageSize: 2048,
      loop: false, repeat: 0, destination: 'folder',
      pageCount: 1, totalFrames: 1, animationCount: 1, markerCount: 0,
    });
    expect(report.issues).toEqual([]);
  });
});

describe('buildExampleTs', () => {
  it('generates single-atlas load.atlas example', () => {
    const ts = buildExampleTs({
      textureKey: 'hero',
      atlasFileNames: ['hero.png'],
      atlasJsonFileName: 'hero.atlas.json',
      animationsJsonFileName: 'hero.animations.json',
      animationKeys: ['hero:idle', 'hero:walk'],
      isMulti: false,
      rootFolder: 'hero-phaser',
    });
    expect(ts).toContain("this.load.atlas('hero', 'hero-phaser/hero.png', 'hero-phaser/hero.atlas.json')");
    expect(ts).not.toContain('this.load.load');
    expect(ts).toContain("play('hero:idle')");
    expect(ts).toContain("play('hero:walk')");
    expect(ts).toContain('hero-phaser/hero.animations.json');
  });

  it('generates multi-atlas load.multiatlas example', () => {
    const ts = buildExampleTs({
      textureKey: 'hero',
      atlasFileNames: ['hero-0.png', 'hero-1.png'],
      atlasJsonFileName: 'hero.atlas.json',
      animationsJsonFileName: 'hero.animations.json',
      animationKeys: ['hero:walk'],
      isMulti: true,
      rootFolder: 'hero-phaser',
    });
    expect(ts).toContain("this.load.multiatlas('hero', 'hero-phaser/hero.atlas.json', 'hero-phaser')");
    expect(ts).toContain('hero-phaser');
  });
});

describe('buildReadme', () => {
  it('lists animation keys and page file names', () => {
    const readme = buildReadme({
      textureKey: 'char',
      animationKeys: ['char:idle', 'char:walk'],
      isMulti: true,
      pageCount: 2,
      markerCount: 5,
      pageFileNames: ['char-0.png', 'char-1.png'],
    });
    expect(readme).toContain('char:idle');
    expect(readme).toContain('char:walk');
    expect(readme).toContain('char-0.png');
    expect(readme).toContain('char-1.png');
    expect(readme).toContain('5 marker(s)');
    expect(readme).toContain('baked');
  });

  it('says no markers when count is 0', () => {
    const readme = buildReadme({
      textureKey: 'x',
      animationKeys: [],
      isMulti: false,
      pageCount: 1,
      markerCount: 0,
      pageFileNames: ['x.png'],
    });
    expect(readme).toContain('No markers');
  });
});
