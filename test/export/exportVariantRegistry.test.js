import { describe, expect, it } from 'vitest';
import {
  listExportVariants,
  listExportTypes,
  listExportFormats,
  resolveExportVariantSelection,
  getExportVariantDefinition,
  resolveActiveExportVariant,
  resolveExportPipeline,
  UnsupportedFormatError,
} from '@/features/export/domain/exportVariantRegistry';

describe('export variant registry', () => {
  it('lists all 7 variants', () => {
    const variants = listExportVariants();
    expect(variants).toHaveLength(7);
    expect(Object.isFrozen(variants)).toBe(true);
    expect(variants.every(Object.isFrozen)).toBe(true);
  });

  it('has unique IDs', () => {
    const ids = listExportVariants().map(v => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has png_sequence as active raster', () => {
    const def = getExportVariantDefinition('png_sequence');
    expect(def).not.toBeNull();
    expect(def.status).toBe('active');
    expect(def.pipeline).toBe('raster');
    expect(def.kind).toBeUndefined();
  });

  it('has gif as active raster', () => {
    const def = getExportVariantDefinition('gif');
    expect(def).not.toBeNull();
    expect(def.status).toBe('active');
    expect(def.pipeline).toBe('raster');
  });

  it('has png_spritesheet as active raster', () => {
    const def = getExportVariantDefinition('png_spritesheet');
    expect(def).not.toBeNull();
    expect(def.status).toBe('active');
    expect(def.pipeline).toBe('raster');
  });

  it('has phaser_atlas as active with phaser_atlas pipeline', () => {
    const def = getExportVariantDefinition('phaser_atlas');
    expect(def).not.toBeNull();
    expect(def.status).toBe('active');
    expect(def.pipeline).toBe('phaser_atlas');
    expect(def.label).toBe('Phaser 4.2.1 — Texture Atlas (Baked)');
  });

  it('maps universal type and format selections to variants', () => {
    expect(listExportTypes().map(type => type.id)).toEqual([
      'sequence', 'spritesheet', 'animation', 'live2d_project', 'live2d', 'spine', 'phaser_atlas',
    ]);
    expect(listExportTypes().filter(type => type.status === 'unactive').map(type => type.id)).toEqual([
      'live2d_project', 'live2d', 'spine',
    ]);
    expect(listExportFormats('spritesheet').map(item => item.format)).toEqual(['png']);
    expect(resolveExportVariantSelection('animation', 'gif').id).toBe('gif');
    expect(() => resolveExportVariantSelection('animation', 'png')).toThrow(UnsupportedFormatError);
  });

  it('marks live2d_project as unactive with null pipeline', () => {
    const def = getExportVariantDefinition('live2d_project');
    expect(def).not.toBeNull();
    expect(def.status).toBe('unactive');
    expect(def.pipeline).toBeNull();
  });

  it('marks live2d as unactive with null pipeline', () => {
    const def = getExportVariantDefinition('live2d');
    expect(def).not.toBeNull();
    expect(def.status).toBe('unactive');
    expect(def.pipeline).toBeNull();
  });

  it('marks spine as unactive with null pipeline', () => {
    const def = getExportVariantDefinition('spine');
    expect(def).not.toBeNull();
    expect(def.status).toBe('unactive');
    expect(def.pipeline).toBeNull();
  });

  it('marks phaser_atlas as active with phaser_atlas pipeline', () => {
    const def = getExportVariantDefinition('phaser_atlas');
    expect(def).not.toBeNull();
    expect(def.status).toBe('active');
    expect(def.pipeline).toBe('phaser_atlas');
    expect(def.label).toBe('Phaser 4.2.1 — Texture Atlas (Baked)');
  });

  it('returns null for unknown ID', () => {
    expect(getExportVariantDefinition('unknown_format')).toBeNull();
  });

  it('resolveActiveExportVariant returns def for active variant', () => {
    const def = resolveActiveExportVariant('png_sequence');
    expect(def.id).toBe('png_sequence');
    expect(def.status).toBe('active');
  });

  it('resolveActiveExportVariant throws for unactive variant', () => {
    expect(() => resolveActiveExportVariant('live2d')).toThrow(UnsupportedFormatError);
    expect(() => resolveActiveExportVariant('live2d')).toThrow('UNSUPPORTED_FORMAT');
  });

  it('resolveActiveExportVariant throws for unknown ID', () => {
    expect(() => resolveActiveExportVariant('nonexistent')).toThrow(UnsupportedFormatError);
    expect(() => resolveActiveExportVariant('nonexistent')).toThrow('UNSUPPORTED_FORMAT');
  });

  it('all three unactive variants throw on resolve', () => {
    expect(() => resolveActiveExportVariant('live2d_project')).toThrow(UnsupportedFormatError);
    expect(() => resolveActiveExportVariant('live2d')).toThrow(UnsupportedFormatError);
    expect(() => resolveActiveExportVariant('spine')).toThrow(UnsupportedFormatError);
  });

  it('resolveActiveExportVariant returns phaser_atlas as active', () => {
    const def = resolveActiveExportVariant('phaser_atlas');
    expect(def.id).toBe('phaser_atlas');
    expect(def.status).toBe('active');
  });

  it('UnsupportedFormatError has code property', () => {
    try {
      resolveActiveExportVariant('live2d');
    } catch (err) {
      expect(err.code).toBe('UNSUPPORTED_FORMAT');
    }
  });

  describe('resolveExportPipeline', () => {
    it('returns "raster" for active raster variants', () => {
      expect(resolveExportPipeline('png_sequence')).toBe('raster');
      expect(resolveExportPipeline('gif')).toBe('raster');
      expect(resolveExportPipeline('png_spritesheet')).toBe('raster');
    });

    it('throws UnsupportedFormatError for unactive variants', () => {
      expect(() => resolveExportPipeline('live2d')).toThrow(UnsupportedFormatError);
      expect(() => resolveExportPipeline('live2d_project')).toThrow(UnsupportedFormatError);
      expect(() => resolveExportPipeline('spine')).toThrow(UnsupportedFormatError);
    });

    it('returns "phaser_atlas" for phaser_atlas pipeline', () => {
      expect(resolveExportPipeline('phaser_atlas')).toBe('phaser_atlas');
    });

    it('throws UnsupportedFormatError for unknown ID', () => {
      expect(() => resolveExportPipeline('nonexistent')).toThrow(UnsupportedFormatError);
    });
  });
});
