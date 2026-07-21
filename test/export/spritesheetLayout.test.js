import { describe, expect, it } from 'vitest';
import {
  resolveSpritesheetLayout,
  suggestSpritesheetLayouts,
} from '@/features/export/domain/spritesheetLayout';

describe('spritesheet layout', () => {
  it('resolves rows from frame count without losing frames', () => {
    expect(resolveSpritesheetLayout(12, 4)).toEqual({ columns: 4, rows: 3, capacity: 12 });
    expect(resolveSpritesheetLayout(11, 4)).toEqual({ columns: 4, rows: 3, capacity: 12 });
  });

  it('offers exact 12-frame divisions including requested layouts', () => {
    const layouts = suggestSpritesheetLayouts({ frameCount: 12, frameWidth: 100, frameHeight: 100 });
    const keys = layouts.map(layout => `${layout.columns}x${layout.rows}`);
    expect(keys).toContain('1x12');
    expect(keys).toContain('2x6');
    expect(keys).toContain('4x3');
  });

  it('recommends a balanced physical sheet using frame aspect ratio', () => {
    const squareFrames = suggestSpritesheetLayouts({ frameCount: 16, frameWidth: 100, frameHeight: 100 });
    expect(squareFrames[0]).toMatchObject({ columns: 4, rows: 4, recommended: true });

    const wideFrames = suggestSpritesheetLayouts({ frameCount: 8, frameWidth: 400, frameHeight: 100 });
    expect(wideFrames[0].columns).toBeLessThanOrEqual(2);
  });

  it('allows compatible near-square layouts for prime frame counts', () => {
    const layouts = suggestSpritesheetLayouts({ frameCount: 11, frameWidth: 100, frameHeight: 100 });
    expect(layouts.some(layout => layout.columns === 4 && layout.rows === 3 && layout.capacity === 12)).toBe(true);
  });
});
