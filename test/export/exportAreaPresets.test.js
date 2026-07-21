import { describe, expect, it } from 'vitest';
import {
  EXPORT_AREA_PRESETS,
  CUSTOM_PRESET_ID,
  getExportAreaPreset,
  matchExportAreaPreset,
  createExportAreaPresetPatch,
} from '@/features/export/domain/exportAreaPresets';

describe('EXPORT_AREA_PRESETS catalog (R3)', () => {
  it('is a frozen exact snapshot of R3', () => {
    expect(Object.isFrozen(EXPORT_AREA_PRESETS)).toBe(true);
    expect(EXPORT_AREA_PRESETS.map((p) => p.id)).toEqual([
      'square-256',
      'square-512',
      'square-1024',
      'pixel-16-9',
      'hd-720',
      'full-hd',
      'portrait-720',
      'classic-4-3',
    ]);
    expect(EXPORT_AREA_PRESETS).toEqual([
      { id: 'square-256', label: '256 × 256', width: 256, height: 256, group: 'Square' },
      { id: 'square-512', label: '512 × 512', width: 512, height: 512, group: 'Square' },
      { id: 'square-1024', label: '1024 × 1024', width: 1024, height: 1024, group: 'Square' },
      { id: 'pixel-16-9', label: '640 × 360 (16:9)', width: 640, height: 360, group: 'Landscape' },
      { id: 'hd-720', label: '1280 × 720', width: 1280, height: 720, group: 'Landscape' },
      { id: 'full-hd', label: '1920 × 1080', width: 1920, height: 1080, group: 'Landscape' },
      { id: 'portrait-720', label: '720 × 1280', width: 720, height: 1280, group: 'Portrait' },
      { id: 'classic-4-3', label: '800 × 600 (4:3)', width: 800, height: 600, group: 'Classic' },
    ]);
  });

  it('every preset has unique id and positive integer dimensions', () => {
    const ids = new Set();
    for (const preset of EXPORT_AREA_PRESETS) {
      expect(ids.has(preset.id)).toBe(false);
      ids.add(preset.id);
      expect(Number.isInteger(preset.width)).toBe(true);
      expect(Number.isInteger(preset.height)).toBe(true);
      expect(preset.width).toBeGreaterThanOrEqual(1);
      expect(preset.height).toBeGreaterThanOrEqual(1);
    }
  });

  it('does not declare engine/program compatibility in labels', () => {
    const banned = /godot|phaser|live2d|spine|unity|unreal|atlas/i;
    for (const preset of EXPORT_AREA_PRESETS) {
      expect(banned.test(preset.label)).toBe(false);
      expect(banned.test(preset.id)).toBe(false);
      expect(banned.test(preset.group)).toBe(false);
    }
  });

  it('groups cover Square, Landscape, Portrait, Classic', () => {
    const groups = new Set(EXPORT_AREA_PRESETS.map((p) => p.group));
    expect(groups).toEqual(new Set(['Square', 'Landscape', 'Portrait', 'Classic']));
  });
});

describe('getExportAreaPreset', () => {
  it('returns the preset for a known id', () => {
    expect(getExportAreaPreset('square-512')).toEqual({
      id: 'square-512', label: '512 × 512', width: 512, height: 512, group: 'Square',
    });
  });

  it('returns null for unknown id', () => {
    expect(getExportAreaPreset('nope')).toBeNull();
  });

  it('returns null for non-string', () => {
    expect(getExportAreaPreset(null)).toBeNull();
    expect(getExportAreaPreset(512)).toBeNull();
  });
});

describe('matchExportAreaPreset', () => {
  it('matches an exact preset', () => {
    expect(matchExportAreaPreset({ width: 512, height: 512 })).toBe('square-512');
    expect(matchExportAreaPreset({ width: 640, height: 360 })).toBe('pixel-16-9');
    expect(matchExportAreaPreset({ width: 1920, height: 1080 })).toBe('full-hd');
  });

  it('returns custom for non-preset dimensions', () => {
    expect(matchExportAreaPreset({ width: 333, height: 222 })).toBe(CUSTOM_PRESET_ID);
    expect(matchExportAreaPreset({ width: 256, height: 512 })).toBe(CUSTOM_PRESET_ID);
  });

  it('returns custom for invalid input', () => {
    expect(matchExportAreaPreset()).toBe(CUSTOM_PRESET_ID);
    expect(matchExportAreaPreset({})).toBe(CUSTOM_PRESET_ID);
    expect(matchExportAreaPreset({ width: 0, height: 0 })).toBe(CUSTOM_PRESET_ID);
    expect(matchExportAreaPreset({ width: -10, height: 10 })).toBe(CUSTOM_PRESET_ID);
    expect(matchExportAreaPreset({ width: 10.5, height: 10 })).toBe(CUSTOM_PRESET_ID);
  });

  it('honors persisted custom identity even when dimensions match a preset', () => {
    expect(matchExportAreaPreset({ width: 800, height: 600, presetId: 'custom' }))
      .toBe(CUSTOM_PRESET_ID);
  });
});

describe('createExportAreaPresetPatch', () => {
  it('returns frozen {width,height} only for a preset', () => {
    const patch = createExportAreaPresetPatch('portrait-720');
    expect(patch).toEqual({ width: 720, height: 1280 });
    expect(Object.isFrozen(patch)).toBe(true);
    expect(patch).not.toHaveProperty('x');
    expect(patch).not.toHaveProperty('y');
    expect(patch).not.toHaveProperty('presetId');
  });

  it('throws TypeError for custom id', () => {
    expect(() => createExportAreaPresetPatch('custom')).toThrow(TypeError);
  });

  it('throws RangeError for unknown id', () => {
    expect(() => createExportAreaPresetPatch('nope')).toThrow(RangeError);
  });

  it('throws TypeError for non-string id', () => {
    expect(() => createExportAreaPresetPatch(null)).toThrow(TypeError);
    expect(() => createExportAreaPresetPatch(512)).toThrow(TypeError);
  });
});
