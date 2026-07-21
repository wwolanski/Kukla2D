import { describe, expect, it } from 'vitest';
import {
  CUSTOM_PRESET_ID,
  createExportAreaPresetPatch,
  getExportAreaPreset,
  matchExportAreaPreset,
} from '@/features/export/domain/exportAreaPresets';

describe('getExportAreaPreset', () => {
  it('returns a preset by valid id', () => {
    const preset = getExportAreaPreset('hd-720');
    expect(preset).not.toBeNull();
    expect(preset!.id).toBe('hd-720');
    expect(preset!.width).toBe(1280);
    expect(preset!.height).toBe(720);
  });

  it('returns null for unknown id', () => {
    expect(getExportAreaPreset('nonexistent')).toBeNull();
  });

  it('returns null for non-string id', () => {
    expect(getExportAreaPreset(123)).toBeNull();
    expect(getExportAreaPreset(null)).toBeNull();
    expect(getExportAreaPreset(undefined)).toBeNull();
  });
});

describe('matchExportAreaPreset', () => {
  it('matches exact preset by width and height', () => {
    expect(matchExportAreaPreset({ width: 1920, height: 1080 })).toBe('full-hd');
  });

  it('returns custom for unknown dimensions', () => {
    expect(matchExportAreaPreset({ width: 999, height: 777 })).toBe(CUSTOM_PRESET_ID);
  });

  it('returns custom when canvas has explicit custom presetId', () => {
    expect(matchExportAreaPreset({ width: 1280, height: 720, presetId: 'custom' })).toBe(CUSTOM_PRESET_ID);
  });

  it('matches preset when explicit presetId matches dimensions', () => {
    expect(matchExportAreaPreset({ width: 800, height: 600, presetId: 'classic-4-3' })).toBe('classic-4-3');
  });

  it('returns custom for invalid dimensions', () => {
    expect(matchExportAreaPreset({ width: -1, height: 100 })).toBe(CUSTOM_PRESET_ID);
    expect(matchExportAreaPreset({ width: 100, height: NaN })).toBe(CUSTOM_PRESET_ID);
  });

  it('returns custom for empty canvas', () => {
    expect(matchExportAreaPreset({})).toBe(CUSTOM_PRESET_ID);
    expect(matchExportAreaPreset()).toBe(CUSTOM_PRESET_ID);
  });
});

describe('createExportAreaPresetPatch', () => {
  it('returns width/height for a known preset', () => {
    const patch = createExportAreaPresetPatch('square-256');
    expect(patch).toEqual({ width: 256, height: 256 });
  });

  it('throws for custom preset id', () => {
    expect(() => createExportAreaPresetPatch('custom')).toThrow(TypeError);
  });

  it('throws for unknown preset id', () => {
    expect(() => createExportAreaPresetPatch('fake-preset')).toThrow(RangeError);
  });

  it('throws for non-string id', () => {
    expect(() => createExportAreaPresetPatch(123)).toThrow(TypeError);
    expect(() => createExportAreaPresetPatch(null)).toThrow(TypeError);
  });
});
