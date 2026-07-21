import { describe, expect, it } from 'vitest';
import {
  PHASER_ATLAS_VARIANT_ID,
  PHASER_ATLAS_PIPELINE_ID,
  PHASER_ATLAS_UI_LABEL,
  PHASER_ATLAS_DEFAULTS,
  PHASER_ATLAS_REPEAT,
  PHASER_ATLAS_ERROR_CODES,
  sanitizePhaserAtlasName,
  buildPhaserAtlasFrameIdentity,
  resolvePhaserAtlasCollision,
  validatePhaserAtlasOptions,
} from '@/features/export/domain/phaserAtlasContract';

describe('phaserAtlasContract', () => {
  describe('canonical IDs', () => {
    it('has correct variant ID', () => {
      expect(PHASER_ATLAS_VARIANT_ID).toBe('phaser_atlas');
    });

    it('has correct pipeline ID', () => {
      expect(PHASER_ATLAS_PIPELINE_ID).toBe('phaser_atlas');
    });

    it('has correct UI label', () => {
      expect(PHASER_ATLAS_UI_LABEL).toBe('Phaser 4.2.1 — Texture Atlas (Baked)');
    });
  });

  describe('defaults', () => {
    it('has expected default values', () => {
      expect(PHASER_ATLAS_DEFAULTS.fps).toBe(24);
      expect(PHASER_ATLAS_DEFAULTS.scale).toBe(100);
      expect(PHASER_ATLAS_DEFAULTS.trim).toBe(true);
      expect(PHASER_ATLAS_DEFAULTS.padding).toBe(2);
      expect(PHASER_ATLAS_DEFAULTS.maxPageSize).toBe(2048);
      expect(PHASER_ATLAS_DEFAULTS.loop).toBe(true);
      expect(PHASER_ATLAS_DEFAULTS.destination).toBe('zip');
    });

    it('defaults object is frozen', () => {
      expect(Object.isFrozen(PHASER_ATLAS_DEFAULTS)).toBe(true);
    });
  });

  describe('repeat mapping (K8)', () => {
    it('maps loop=true to repeat=-1', () => {
      expect(PHASER_ATLAS_REPEAT.fromLoop(true)).toBe(-1);
    });

    it('maps loop=false to repeat=0', () => {
      expect(PHASER_ATLAS_REPEAT.fromLoop(false)).toBe(0);
    });
  });

  describe('sanitizePhaserAtlasName', () => {
    it('passes through clean names', () => {
      expect(sanitizePhaserAtlasName('idle')).toBe('idle');
      expect(sanitizePhaserAtlasName('walk-cycle')).toBe('walk-cycle');
      expect(sanitizePhaserAtlasName('anim_01')).toBe('anim_01');
    });

    it('replaces special characters with underscore', () => {
      expect(sanitizePhaserAtlasName('idle animation')).toBe('idle_animation');
      expect(sanitizePhaserAtlasName('walk/cycle')).toBe('walk_cycle');
      expect(sanitizePhaserAtlasName('a@b#c')).toBe('a_b_c');
    });

    it('collapses consecutive underscores', () => {
      expect(sanitizePhaserAtlasName('a  b')).toBe('a_b');
    });

    it('trims leading/trailing underscores', () => {
      expect(sanitizePhaserAtlasName('_idle_')).toBe('idle');
    });

    it('returns untitled for empty or invalid input', () => {
      expect(sanitizePhaserAtlasName('')).toBe('untitled');
      expect(sanitizePhaserAtlasName('___')).toBe('untitled');
      expect(sanitizePhaserAtlasName(null)).toBe('untitled');
      expect(sanitizePhaserAtlasName(undefined)).toBe('untitled');
    });
  });

  describe('buildPhaserAtlasFrameIdentity', () => {
    it('builds identity from anim name, id and frame index', () => {
      expect(buildPhaserAtlasFrameIdentity('Idle', 'a1', 0)).toBe('Idle-a1/0000');
      expect(buildPhaserAtlasFrameIdentity('Idle', 'a1', 5)).toBe('Idle-a1/0005');
      expect(buildPhaserAtlasFrameIdentity('Walk Cycle', 'a2', 12)).toBe('Walk_Cycle-a2/0012');
    });

    it('pads frame index to 4 digits', () => {
      expect(buildPhaserAtlasFrameIdentity('Idle', 'a1', 99)).toBe('Idle-a1/0099');
      expect(buildPhaserAtlasFrameIdentity('Idle', 'a1', 999)).toBe('Idle-a1/0999');
      expect(buildPhaserAtlasFrameIdentity('Idle', 'a1', 1000)).toBe('Idle-a1/1000');
    });
  });

  describe('resolvePhaserAtlasCollision', () => {
    it('returns candidate when no collision', () => {
      const keys = new Set(['a', 'b']);
      expect(resolvePhaserAtlasCollision(keys, 'c')).toBe('c');
    });

    it('appends _2 on first collision', () => {
      const keys = new Set(['idle-a1/0000']);
      expect(resolvePhaserAtlasCollision(keys, 'idle-a1/0000')).toBe('idle-a1/0000_2');
    });

    it('increments suffix on repeated collision', () => {
      const keys = new Set(['idle-a1/0000', 'idle-a1/0000_2', 'idle-a1/0000_3']);
      expect(resolvePhaserAtlasCollision(keys, 'idle-a1/0000')).toBe('idle-a1/0000_4');
    });
  });

  describe('validatePhaserAtlasOptions', () => {
    const validOptions = {
      fps: 24,
      scale: 100,
      padding: 2,
      maxPageSize: 2048,
      animations: [{ id: 'a1', name: 'Idle' }],
    };

    it('returns no errors for valid options', () => {
      expect(validatePhaserAtlasOptions(validOptions)).toEqual([]);
    });

    it('returns error for empty animations', () => {
      const errors = validatePhaserAtlasOptions({ ...validOptions, animations: [] });
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe(PHASER_ATLAS_ERROR_CODES.NO_ANIMATIONS);
    });

    it('returns error for missing animations', () => {
      const errors = validatePhaserAtlasOptions({ fps: 24 });
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe(PHASER_ATLAS_ERROR_CODES.NO_ANIMATIONS);
    });

    it('returns error for fps out of range', () => {
      const errors = validatePhaserAtlasOptions({ ...validOptions, fps: 0 });
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe(PHASER_ATLAS_ERROR_CODES.INVALID_OPTION);
      expect(errors[0].path).toBe('fps');
    });

    it('returns error for fps above max', () => {
      const errors = validatePhaserAtlasOptions({ ...validOptions, fps: 121 });
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe(PHASER_ATLAS_ERROR_CODES.INVALID_OPTION);
    });

    it('returns error for scale out of range', () => {
      const errors = validatePhaserAtlasOptions({ ...validOptions, scale: 0 });
      expect(errors).toHaveLength(1);
      expect(errors[0].path).toBe('scale');
    });

    it('returns error for non-integer padding', () => {
      const errors = validatePhaserAtlasOptions({ ...validOptions, padding: 1.5 });
      expect(errors).toHaveLength(1);
      expect(errors[0].path).toBe('padding');
    });

    it('returns error for padding above max', () => {
      const errors = validatePhaserAtlasOptions({ ...validOptions, padding: 33 });
      expect(errors).toHaveLength(1);
      expect(errors[0].path).toBe('padding');
    });

    it('returns error for invalid maxPageSize', () => {
      const errors = validatePhaserAtlasOptions({ ...validOptions, maxPageSize: 1024 });
      expect(errors).toHaveLength(1);
      expect(errors[0].path).toBe('maxPageSize');
    });

    it('accepts maxPageSize 4096', () => {
      expect(validatePhaserAtlasOptions({ ...validOptions, maxPageSize: 4096 })).toEqual([]);
    });

    it('returns multiple errors for multiple invalid options', () => {
      const errors = validatePhaserAtlasOptions({ fps: 0, scale: 0, animations: [] });
      expect(errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('error codes', () => {
    it('has all expected error codes', () => {
      expect(PHASER_ATLAS_ERROR_CODES.INVALID_OPTION).toBe('PHASER_ATLAS_INVALID_OPTION');
      expect(PHASER_ATLAS_ERROR_CODES.NO_ANIMATIONS).toBe('PHASER_ATLAS_NO_ANIMATIONS');
      expect(PHASER_ATLAS_ERROR_CODES.DUPLICATE_KEY).toBe('PHASER_ATLAS_DUPLICATE_KEY');
      expect(PHASER_ATLAS_ERROR_CODES.OVERSIZED_FRAME).toBe('PHASER_ATLAS_OVERSIZED_FRAME');
      expect(PHASER_ATLAS_ERROR_CODES.INVALID_SCHEMA).toBe('PHASER_ATLAS_INVALID_SCHEMA');
    });

    it('error codes object is frozen', () => {
      expect(Object.isFrozen(PHASER_ATLAS_ERROR_CODES)).toBe(true);
    });
  });
});
