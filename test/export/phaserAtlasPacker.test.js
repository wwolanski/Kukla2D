import { describe, expect, it } from 'vitest';
import { packAtlasFrames, validatePackLayout } from '../../packages/adapters/phaser-atlas/src/index.js';

function frame(identity, cropW, cropH, sourceWidth = cropW, sourceHeight = cropH, cropX = 0, cropY = 0) {
  return { identity, cropX, cropY, cropW, cropH, sourceWidth, sourceHeight, empty: false };
}

function emptyFrame(identity, sourceWidth, sourceHeight) {
  return { identity, cropX: 0, cropY: 0, cropW: 1, cropH: 1, sourceWidth, sourceHeight, empty: true };
}

describe('packAtlasFrames', () => {
  describe('validation', () => {
    it('rejects invalid padding', () => {
      expect(() => packAtlasFrames([], -1, 2048)).toThrow('padding must be integer');
    });

    it('rejects non-integer padding', () => {
      expect(() => packAtlasFrames([], 1.5, 2048)).toThrow('padding must be integer');
    });

    it('rejects invalid maxPageSize', () => {
      expect(() => packAtlasFrames([], 0, -1)).toThrow('maxPageSize must be a positive integer');
    });
  });

  describe('empty input', () => {
    it('returns zero pages for empty frames', () => {
      const result = packAtlasFrames([], 0, 2048);
      expect(result.pages).toHaveLength(0);
    });

    it('returns zero pages for empty frames with padding', () => {
      const result = packAtlasFrames([], 4, 2048);
      expect(result.pages).toHaveLength(0);
    });
  });

  describe('single frame', () => {
    it('places one frame on one page', () => {
      const result = packAtlasFrames([frame('a', 32, 32)], 0, 2048);
      expect(result.pages).toHaveLength(1);
      expect(result.pages[0].regions).toHaveLength(1);
      expect(result.pages[0].regions[0].name).toBe('a');
      expect(result.pages[0].regions[0].frame).toEqual({ x: 0, y: 0, w: 32, h: 32 });
      expect(result.pages[0].regions[0].rotated).toBe(false);
    });

    it('page dimensions match padded frame', () => {
      const result = packAtlasFrames([frame('a', 32, 32)], 2, 2048);
      expect(result.pages[0].width).toBe(36);
      expect(result.pages[0].height).toBe(36);
      expect(result.pages[0].regions[0].frame).toEqual({ x: 2, y: 2, w: 32, h: 32 });
    });
  });

  describe('determinism', () => {
    it('repeated call with same input gives identical output', () => {
      const frames = [
        frame('b', 20, 30, 40, 50, 5, 10),
        frame('a', 30, 20, 50, 40, 10, 5),
        frame('c', 10, 10),
      ];
      const r1 = packAtlasFrames(frames, 2, 2048);
      const r2 = packAtlasFrames([...frames], 2, 2048);
      expect(r1).toEqual(r2);
    });

    it('input order does not affect layout', () => {
      const framesA = [frame('a', 32, 32), frame('b', 16, 16), frame('c', 24, 24)];
      const framesB = [frame('c', 24, 24), frame('a', 32, 32), frame('b', 16, 16)];
      const rA = packAtlasFrames(framesA, 0, 2048);
      const rB = packAtlasFrames(framesB, 0, 2048);
      expect(rA).toEqual(rB);
    });

    it('copied input does not mutate original', () => {
      const frames = [frame('a', 32, 32), frame('b', 16, 16)];
      const copy = frames.map((f) => ({ ...f }));
      packAtlasFrames(frames, 2, 2048);
      expect(frames).toEqual(copy);
    });
  });

  describe('duplicate key', () => {
    it('returns DUPLICATE_KEY error', () => {
      const frames = [frame('a', 10, 10), frame('a', 20, 20)];
      const result = packAtlasFrames(frames, 0, 2048);
      expect(result.code).toBe('PHASER_ATLAS_DUPLICATE_KEY');
      expect(result.frameKey).toBe('a');
    });
  });

  describe('oversized frame', () => {
    it('returns OVERSIZED_FRAME when padded frame exceeds max page', () => {
      const frames = [frame('big', 2050, 32)];
      const result = packAtlasFrames(frames, 0, 2048);
      expect(result.code).toBe('PHASER_ATLAS_OVERSIZED_FRAME');
      expect(result.frameKey).toBe('big');
      expect(result.requiredSize).toBe(2050);
      expect(result.selectedSize).toBe(2048);
    });

    it('returns OVERSIZED_FRAME when padding pushes over limit', () => {
      const frames = [frame('edge', 2046, 32)];
      const result = packAtlasFrames(frames, 2, 2048);
      expect(result.code).toBe('PHASER_ATLAS_OVERSIZED_FRAME');
      expect(result.requiredSize).toBe(2050);
    });

    it('exact-fit at max page succeeds', () => {
      const frames = [frame('exact', 2048, 32)];
      const result = packAtlasFrames(frames, 0, 2048);
      expect(result.pages).toHaveLength(1);
      expect(result.pages[0].regions[0].name).toBe('exact');
    });
  });

  describe('forced multiatlas', () => {
    it('small max forces minimum 2 pages', () => {
      const frames = [
        frame('a', 48, 32),
        frame('b', 48, 32),
        frame('c', 48, 32),
      ];
      const result = packAtlasFrames(frames, 0, 64);
      expect(result.pages.length).toBeGreaterThanOrEqual(2);
    });

    it('three frames each needing full page', () => {
      const frames = [
        frame('a', 60, 60),
        frame('b', 60, 60),
        frame('c', 60, 60),
      ];
      const result = packAtlasFrames(frames, 2, 64);
      expect(result.pages).toHaveLength(3);
    });

    it('multi-page layout has correct page indices', () => {
      const frames = [
        frame('a', 60, 32),
        frame('b', 60, 32),
      ];
      const result = packAtlasFrames(frames, 2, 64);
      expect(result.pages[0].regions[0].pageIndex).toBe(0);
      expect(result.pages[1].regions[0].pageIndex).toBe(1);
    });
  });

  describe('no overlap invariant', () => {
    it('regions with padding do not overlap', () => {
      const frames = [
        frame('a', 100, 100),
        frame('b', 80, 60),
        frame('c', 50, 50),
        frame('d', 30, 40),
      ];
      const result = packAtlasFrames(frames, 4, 2048);
      const errors = validatePackLayout(frames, result, 4);
      expect(errors).toEqual([]);
    });

    it('property-like: small rectangles pack without overlap', () => {
      for (let seed = 0; seed < 5; seed++) {
        const frames = [];
        for (let i = 0; i < 6; i++) {
          const w = 10 + ((seed * 7 + i * 13) % 40);
          const h = 10 + ((seed * 11 + i * 17) % 40);
          frames.push(frame(`f${i}`, w, h));
        }
        const result = packAtlasFrames(frames, 2, 256);
        if ('code' in result) continue;
        const errors = validatePackLayout(frames, result, 2);
        expect(errors).toEqual([]);
      }
    });
  });

  describe('page bounds', () => {
    it('no page exceeds maxPageSize', () => {
      const frames = [
        frame('a', 100, 80),
        frame('b', 60, 40),
        frame('c', 200, 150),
        frame('d', 30, 20),
      ];
      const result = packAtlasFrames(frames, 2, 256);
      for (const page of result.pages) {
        expect(page.width).toBeLessThanOrEqual(256);
        expect(page.height).toBeLessThanOrEqual(256);
      }
    });

    it('page can be reduced to used area', () => {
      const frames = [frame('a', 32, 32)];
      const result = packAtlasFrames(frames, 0, 2048);
      expect(result.pages[0].width).toBe(32);
      expect(result.pages[0].height).toBe(32);
    });
  });

  describe('trim metadata', () => {
    it('trimmed=true when crop differs from source', () => {
      const frames = [frame('a', 20, 20, 32, 32, 6, 6)];
      const result = packAtlasFrames(frames, 0, 2048);
      expect(result.pages[0].regions[0].trimmed).toBe(true);
      expect(result.pages[0].regions[0].spriteSourceSize).toEqual({ x: 6, y: 6, w: 20, h: 20 });
      expect(result.pages[0].regions[0].sourceSize).toEqual({ w: 32, h: 32 });
    });

    it('trimmed=false when crop equals source', () => {
      const frames = [frame('full', 32, 32, 32, 32, 0, 0)];
      const result = packAtlasFrames(frames, 0, 2048);
      expect(result.pages[0].regions[0].trimmed).toBe(false);
    });

    it('empty frame is marked as trimmed', () => {
      const frames = [emptyFrame('empty', 64, 64)];
      const result = packAtlasFrames(frames, 0, 2048);
      expect(result.pages[0].regions[0].trimmed).toBe(true);
      expect(result.pages[0].regions[0].spriteSourceSize).toEqual({ x: 0, y: 0, w: 1, h: 1 });
      expect(result.pages[0].regions[0].sourceSize).toEqual({ w: 64, h: 64 });
    });
  });

  describe('exact-fit and padding-fit', () => {
    it('two frames fitting exactly side by side', () => {
      const frames = [frame('a', 32, 32), frame('b', 32, 32)];
      const result = packAtlasFrames(frames, 0, 64);
      expect(result.pages).toHaveLength(1);
      expect(result.pages[0].width).toBeLessThanOrEqual(64);
      expect(result.pages[0].height).toBeLessThanOrEqual(64);
    });

    it('one-pixel overflow pushes to second page', () => {
      const frames = [frame('a', 33, 33), frame('b', 33, 33)];
      const result = packAtlasFrames(frames, 0, 64);
      expect(result.pages).toHaveLength(2);
    });
  });

  describe('comparator tie-breaks', () => {
    it('taller frames are placed first', () => {
      const frames = [
        frame('short', 40, 10),
        frame('tall', 10, 40),
      ];
      const result = packAtlasFrames(frames, 0, 2048);
      const names = result.pages[0].regions.map((r) => r.name);
      expect(names[0]).toBe('tall');
    });

    it('same height, area, and width — sorted by identity', () => {
      const frames = [
        frame('z', 20, 10),
        frame('a', 20, 10),
      ];
      const result = packAtlasFrames(frames, 0, 2048);
      const names = result.pages[0].regions.map((r) => r.name);
      expect(names).toEqual(['a', 'z']);
    });
  });

  describe('mixed empty and non-empty', () => {
    it('empty frames are preserved in layout', () => {
      const frames = [
        frame('a', 32, 32),
        emptyFrame('empty', 64, 48),
        frame('b', 16, 16),
      ];
      const result = packAtlasFrames(frames, 2, 2048);
      const allNames = result.pages.flatMap((p) => p.regions.map((r) => r.name));
      expect(allNames).toContain('empty');
      expect(allNames).toHaveLength(3);
    });
  });

  describe('frozen output', () => {
    it('pages array is frozen', () => {
      const result = packAtlasFrames([frame('a', 10, 10)], 0, 2048);
      expect(Object.isFrozen(result.pages)).toBe(true);
    });

    it('regions array is frozen', () => {
      const result = packAtlasFrames([frame('a', 10, 10)], 0, 2048);
      expect(Object.isFrozen(result.pages[0].regions)).toBe(true);
    });
  });
});

describe('validatePackLayout', () => {
  it('returns no errors for valid layout', () => {
    const frames = [frame('a', 32, 32), frame('b', 16, 16)];
    const result = packAtlasFrames(frames, 2, 2048);
    expect(validatePackLayout(frames, result, 2)).toEqual([]);
  });

  it('detects missing region', () => {
    const frames = [frame('a', 32, 32), frame('b', 16, 16)];
    const result = packAtlasFrames(frames, 2, 2048);
    const tampered = {
      pages: [{ ...result.pages[0], regions: [result.pages[0].regions[0]] }],
    };
    const errors = validatePackLayout(frames, tampered, 2);
    expect(errors.some((e) => e.includes('Missing region'))).toBe(true);
  });

  it('empty input with zero pages is valid', () => {
    expect(validatePackLayout([], { pages: [] }, 0)).toEqual([]);
  });
});
