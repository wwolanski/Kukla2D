import { describe, it, expect } from 'vitest';
import {
  TRACK_VALUE_CATEGORIES,
  getTrackValueCategory,
  isSupportedTrackProperty,
  getAnimationPropertySpec,
  getAllAnimationPropertySpecs,
  isAuthorableProperty,
  isRenderedProperty,
  isPropertyAllowedForTargetKind,
  getPropertyInterpolation,
  validateTrackValue,
  isValidEasing,
  easingEquals,
} from '../src/domain/animationProperties.js';

describe('animationProperties', () => {
  describe('TRACK_VALUE_CATEGORIES', () => {
    it('exposes expected categories', () => {
      expect(TRACK_VALUE_CATEGORIES.NUMERIC).toBe('numeric');
      expect(TRACK_VALUE_CATEGORIES.BOOLEAN).toBe('boolean');
      expect(TRACK_VALUE_CATEGORIES.MESH_VERTICES).toBe('meshVertices');
      expect(TRACK_VALUE_CATEGORIES.BLEND_SHAPE).toBe('blendShape');
      expect(TRACK_VALUE_CATEGORIES.EVENT).toBe('event');
    });
  });

  describe('getTrackValueCategory', () => {
    it('returns numeric for transform properties', () => {
      expect(getTrackValueCategory('x')).toBe('numeric');
      expect(getTrackValueCategory('y')).toBe('numeric');
      expect(getTrackValueCategory('rotation')).toBe('numeric');
      expect(getTrackValueCategory('scaleX')).toBe('numeric');
      expect(getTrackValueCategory('scaleY')).toBe('numeric');
      expect(getTrackValueCategory('opacity')).toBe('numeric');
    });

    it('returns boolean for boolean properties', () => {
      expect(getTrackValueCategory('visible')).toBe('boolean');
      expect(getTrackValueCategory('bendPositive')).toBe('boolean');
    });

    it('returns meshVertices for mesh_verts', () => {
      expect(getTrackValueCategory('mesh_verts')).toBe('meshVertices');
    });

    it('returns blendShape for blendShape:* pattern', () => {
      expect(getTrackValueCategory('blendShape:smile')).toBe('blendShape');
      expect(getTrackValueCategory('blendShape:blink')).toBe('blendShape');
    });

    it('returns event for event', () => {
      expect(getTrackValueCategory('event')).toBe('event');
    });

    it('returns numeric for IK properties', () => {
      expect(getTrackValueCategory('targetX')).toBe('numeric');
      expect(getTrackValueCategory('targetY')).toBe('numeric');
      expect(getTrackValueCategory('mix')).toBe('numeric');
      expect(getTrackValueCategory('fkIk')).toBe('numeric');
      expect(getTrackValueCategory('order')).toBe('numeric');
      expect(getTrackValueCategory('drawOrder')).toBe('numeric');
    });

    it('returns null for unknown property', () => {
      expect(getTrackValueCategory('unknown')).toBeNull();
      expect(getTrackValueCategory('')).toBeNull();
      expect(getTrackValueCategory(42)).toBeNull();
    });
  });

  describe('isSupportedTrackProperty', () => {
    it('returns true for known properties', () => {
      expect(isSupportedTrackProperty('x')).toBe(true);
      expect(isSupportedTrackProperty('blendShape:test')).toBe(true);
      expect(isSupportedTrackProperty('event')).toBe(true);
    });

    it('returns false for unknown properties', () => {
      expect(isSupportedTrackProperty('foo')).toBe(false);
      expect(isSupportedTrackProperty('')).toBe(false);
    });
  });

  describe('getAnimationPropertySpec', () => {
    it('returns spec for static properties', () => {
      const spec = getAnimationPropertySpec('x');
      expect(spec).not.toBeNull();
      expect(spec.property).toBe('x');
      expect(spec.targetKinds).toContain('node');
      expect(spec.valueCategory).toBe('numeric');
      expect(spec.authorable).toBe(true);
      expect(spec.rendered).toBe(true);
    });

    it('returns spec for blendShape:* pattern', () => {
      const spec = getAnimationPropertySpec('blendShape:smile');
      expect(spec).not.toBeNull();
      expect(spec.property).toBe('blendShape:');
      expect(spec.targetKinds).toContain('node');
      expect(spec.valueCategory).toBe('blendShape');
      expect(spec.authorable).toBe(true);
      expect(spec.min).toBe(0);
      expect(spec.max).toBe(1);
    });

    it('returns spec for event (non-authorable)', () => {
      const spec = getAnimationPropertySpec('event');
      expect(spec).not.toBeNull();
      expect(spec.authorable).toBe(false);
      expect(spec.rendered).toBe(false);
    });

    it('returns null for unknown property', () => {
      expect(getAnimationPropertySpec('unknown')).toBeNull();
      expect(getAnimationPropertySpec('')).toBeNull();
    });
  });

  describe('getAllAnimationPropertySpecs', () => {
    it('returns all static specs', () => {
      const specs = getAllAnimationPropertySpecs();
      expect(specs.length).toBeGreaterThanOrEqual(16);
      const names = specs.map((s) => s.property);
      expect(names).toContain('x');
      expect(names).toContain('opacity');
      expect(names).toContain('visible');
      expect(names).toContain('mesh_verts');
      expect(names).toContain('event');
      expect(names).toContain('drawOrder');
    });
  });

  describe('isAuthorableProperty', () => {
    it('returns true for authorable properties', () => {
      expect(isAuthorableProperty('x')).toBe(true);
      expect(isAuthorableProperty('opacity')).toBe(true);
      expect(isAuthorableProperty('visible')).toBe(true);
      expect(isAuthorableProperty('blendShape:smile')).toBe(true);
    });

    it('returns false for non-authorable properties', () => {
      expect(isAuthorableProperty('event')).toBe(false);
    });

    it('returns false for unknown properties', () => {
      expect(isAuthorableProperty('unknown')).toBe(false);
    });
  });

  describe('isRenderedProperty', () => {
    it('returns true for rendered properties', () => {
      expect(isRenderedProperty('x')).toBe(true);
      expect(isRenderedProperty('opacity')).toBe(true);
    });

    it('returns false for non-rendered properties', () => {
      expect(isRenderedProperty('event')).toBe(false);
    });
  });

  describe('isPropertyAllowedForTargetKind', () => {
    it('allows x for node and bone', () => {
      expect(isPropertyAllowedForTargetKind('x', 'node')).toBe(true);
      expect(isPropertyAllowedForTargetKind('x', 'bone')).toBe(true);
      expect(isPropertyAllowedForTargetKind('x', 'constraint')).toBe(false);
    });

    it('allows opacity only for node', () => {
      expect(isPropertyAllowedForTargetKind('opacity', 'node')).toBe(true);
      expect(isPropertyAllowedForTargetKind('opacity', 'bone')).toBe(false);
    });

    it('allows targetX only for constraint', () => {
      expect(isPropertyAllowedForTargetKind('targetX', 'constraint')).toBe(true);
      expect(isPropertyAllowedForTargetKind('targetX', 'node')).toBe(false);
    });

    it('allows drawOrder for node and slot', () => {
      expect(isPropertyAllowedForTargetKind('drawOrder', 'node')).toBe(true);
      expect(isPropertyAllowedForTargetKind('drawOrder', 'slot')).toBe(true);
      expect(isPropertyAllowedForTargetKind('drawOrder', 'bone')).toBe(false);
    });
  });

  describe('getPropertyInterpolation', () => {
    it('returns cubic for transform properties', () => {
      expect(getPropertyInterpolation('x')).toBe('cubic');
      expect(getPropertyInterpolation('opacity')).toBe('cubic');
    });

    it('returns none for boolean properties', () => {
      expect(getPropertyInterpolation('visible')).toBe('none');
      expect(getPropertyInterpolation('bendPositive')).toBe('none');
    });

    it('returns none for integer properties', () => {
      expect(getPropertyInterpolation('order')).toBe('none');
      expect(getPropertyInterpolation('drawOrder')).toBe('none');
    });

    it('returns cubic for blendShape', () => {
      expect(getPropertyInterpolation('blendShape:test')).toBe('cubic');
    });

    it('returns null for unknown', () => {
      expect(getPropertyInterpolation('unknown')).toBeNull();
    });
  });

  describe('validateTrackValue', () => {
    it('validates numeric values', () => {
      expect(validateTrackValue('x', 42)).toBe(true);
      expect(validateTrackValue('x', 0)).toBe(true);
      expect(validateTrackValue('x', -1.5)).toBe(true);
      expect(validateTrackValue('x', Infinity)).toBe(false);
      expect(validateTrackValue('x', NaN)).toBe(false);
      expect(validateTrackValue('x', '42')).toBe(false);
    });

    it('validates opacity range [0, 1]', () => {
      expect(validateTrackValue('opacity', 0)).toBe(true);
      expect(validateTrackValue('opacity', 0.5)).toBe(true);
      expect(validateTrackValue('opacity', 1)).toBe(true);
      expect(validateTrackValue('opacity', -0.1)).toBe(false);
      expect(validateTrackValue('opacity', 1.1)).toBe(false);
    });

    it('validates mix range [0, 1]', () => {
      expect(validateTrackValue('mix', 0)).toBe(true);
      expect(validateTrackValue('mix', 1)).toBe(true);
      expect(validateTrackValue('mix', 1.5)).toBe(false);
    });

    it('validates fkIk range [0, 1]', () => {
      expect(validateTrackValue('fkIk', 0)).toBe(true);
      expect(validateTrackValue('fkIk', 1)).toBe(true);
      expect(validateTrackValue('fkIk', -0.5)).toBe(false);
    });

    it('validates blendShape range [0, 1]', () => {
      expect(validateTrackValue('blendShape:smile', 0)).toBe(true);
      expect(validateTrackValue('blendShape:smile', 0.5)).toBe(true);
      expect(validateTrackValue('blendShape:smile', 1)).toBe(true);
      expect(validateTrackValue('blendShape:smile', -0.1)).toBe(false);
      expect(validateTrackValue('blendShape:smile', 1.5)).toBe(false);
    });

    it('validates boolean values', () => {
      expect(validateTrackValue('visible', true)).toBe(true);
      expect(validateTrackValue('visible', false)).toBe(true);
      expect(validateTrackValue('visible', 0)).toBe(false);
      expect(validateTrackValue('visible', 'true')).toBe(false);
    });

    it('validates mesh_vertices as finite {x,y} array', () => {
      expect(validateTrackValue('mesh_verts', [{ x: 0, y: 0 }])).toBe(true);
      expect(validateTrackValue('mesh_verts', [])).toBe(true);
      expect(validateTrackValue('mesh_verts', [{ x: 1, y: 2 }, { x: 3, y: 4 }])).toBe(true);
      expect(validateTrackValue('mesh_verts', [{ x: 1, y: Infinity }])).toBe(false);
      expect(validateTrackValue('mesh_verts', 'no')).toBe(false);
      expect(validateTrackValue('mesh_verts', [{ x: 1 }])).toBe(false);
    });

    it('validates integer order/drawOrder', () => {
      expect(validateTrackValue('order', 0)).toBe(true);
      expect(validateTrackValue('order', 1)).toBe(true);
      expect(validateTrackValue('order', -1)).toBe(true);
      expect(validateTrackValue('order', 0.5)).toBe(false);
      expect(validateTrackValue('drawOrder', 0)).toBe(true);
      expect(validateTrackValue('drawOrder', 2.5)).toBe(false);
    });

    it('validates event as string or object', () => {
      expect(validateTrackValue('event', 'click')).toBe(true);
      expect(validateTrackValue('event', { type: 'custom' })).toBe(true);
      expect(validateTrackValue('event', 42)).toBe(false);
    });
  });

  describe('isValidEasing', () => {
    it('accepts valid presets', () => {
      expect(isValidEasing('linear')).toBe(true);
      expect(isValidEasing('ease')).toBe(true);
      expect(isValidEasing('ease-both')).toBe(true);
      expect(isValidEasing('ease-in')).toBe(true);
      expect(isValidEasing('ease-out')).toBe(true);
      expect(isValidEasing('stepped')).toBe(true);
    });

    it('accepts cubic bezier tuple', () => {
      expect(isValidEasing([0.42, 0, 0.58, 1])).toBe(true);
      expect(isValidEasing([0, 0, 1, 1])).toBe(true);
    });

    it('rejects invalid presets', () => {
      expect(isValidEasing('bogus')).toBe(false);
      expect(isValidEasing('')).toBe(false);
    });

    it('rejects invalid arrays', () => {
      expect(isValidEasing([0.42, 0, 0.58])).toBe(false);
      expect(isValidEasing([0.42, 0, 0.58, 1, 0])).toBe(false);
      expect(isValidEasing([0.42, 0, 0.58, '1'])).toBe(false);
      expect(isValidEasing([0.42, 0, 0.58, Infinity])).toBe(false);
    });

    it('rejects non-string non-array', () => {
      expect(isValidEasing(42)).toBe(false);
      expect(isValidEasing(null)).toBe(false);
      expect(isValidEasing(undefined)).toBe(false);
    });
  });

  describe('easingEquals', () => {
    it('returns true for identical strings', () => {
      expect(easingEquals('linear', 'linear')).toBe(true);
      expect(easingEquals('ease-in', 'ease-in')).toBe(true);
    });

    it('returns true for identical arrays', () => {
      expect(easingEquals([0.42, 0, 0.58, 1], [0.42, 0, 0.58, 1])).toBe(true);
    });

    it('returns true for same reference', () => {
      const arr = [0.42, 0, 0.58, 1];
      expect(easingEquals(arr, arr)).toBe(true);
    });

    it('returns false for different strings', () => {
      expect(easingEquals('linear', 'ease-in')).toBe(false);
    });

    it('returns false for different arrays', () => {
      expect(easingEquals([0.42, 0, 0.58, 1], [0.25, 0.1, 0.25, 1])).toBe(false);
    });

    it('returns false for different types', () => {
      expect(easingEquals('linear', [0.42, 0, 0.58, 1])).toBe(false);
    });

    it('returns false for different length arrays', () => {
      expect(easingEquals([0.42, 0, 0.58], [0.42, 0, 0.58, 1])).toBe(false);
    });
  });
});
