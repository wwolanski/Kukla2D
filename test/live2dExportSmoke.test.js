import { describe, expect, it } from 'vitest';
import { generateMoc3 } from '@/io/live2d/moc3writer.js';
import { generateMotion3Json } from '@/io/live2d/motion3json.js';

describe('Live2D export smoke', () => {
  it('generates moc3 without the removed app parameter subsystem', () => {
    const moc3 = generateMoc3({
      project: {
        canvas: { width: 512, height: 512 },
        nodes: [],
        animations: [],
      },
      regions: new Map(),
      atlasSize: 2048,
      numAtlases: 0,
    });

    expect(moc3).toBeInstanceOf(ArrayBuffer);
    expect(moc3.byteLength).toBeGreaterThan(64);
    expect(Array.from(new Uint8Array(moc3, 0, 4))).toEqual([0x4d, 0x4f, 0x43, 0x33]);
  });

  it('generates motion curves without app parameter records', () => {
    const motion = generateMotion3Json({
      duration: 1000,
      fps: 24,
      tracks: [{
        targetId: 'part-1',
        property: 'opacity',
        keyframes: [
          { time: 0, value: 1 },
          { time: 1000, value: 0.5 },
        ],
      }],
    });

    expect(motion.Meta.CurveCount).toBe(1);
    expect(motion.Curves[0]).toMatchObject({
      Target: 'PartOpacity',
      Id: 'part-1',
    });
  });
});
