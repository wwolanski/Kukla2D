import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  safeGlobalStorage,
  loadAnimationSettings,
  saveAnimationSettings,
  resetAnimationSettings,
} from '../../src/platform/animationSettingsRepository.js';
import { ANIMATION_DEFAULTS } from '../../src/domain/animationDefaults.js';

describe('animationSettingsRepository', () => {
  let storage;

  beforeEach(() => {
    storage = createMockStorage();
  });

  function createMockStorage() {
    const data = {};
    return {
      getItem: vi.fn((key) => data[key] ?? null),
      setItem: vi.fn((key, value) => { data[key] = value; }),
      removeItem: vi.fn((key) => { delete data[key]; }),
      get length() { return Object.keys(data).length; },
      key: vi.fn((i) => Object.keys(data)[i] ?? null),
      clear: vi.fn(() => { Object.keys(data).forEach((k) => delete data[k]); }),
    };
  }

  describe('loadAnimationSettings', () => {
    it('returns defaults when storage is null', () => {
      const result = loadAnimationSettings(null);
      expect(result).toEqual(ANIMATION_DEFAULTS);
    });

    it('returns defaults when no saved data', () => {
      const result = loadAnimationSettings(storage);
      expect(result).toEqual(ANIMATION_DEFAULTS);
    });

    it('returns saved settings with correct version', () => {
      storage.setItem('kukla2d.animation-settings.v1', JSON.stringify({
        version: 1, frameCount: 60, fps: 30, speed: 1.5,
      }));
      const result = loadAnimationSettings(storage);
      expect(result).toEqual({ frameCount: 60, fps: 30, speed: 1.5 });
    });

    it('returns defaults for corrupt JSON', () => {
      storage.setItem('kukla2d.animation-settings.v1', '{bad json');
      const result = loadAnimationSettings(storage);
      expect(result).toEqual(ANIMATION_DEFAULTS);
    });

    it('returns defaults for unknown version', () => {
      storage.setItem('kukla2d.animation-settings.v1', JSON.stringify({
        version: 999, frameCount: 60, fps: 30, speed: 1,
      }));
      const result = loadAnimationSettings(storage);
      expect(result).toEqual(ANIMATION_DEFAULTS);
    });

    it('returns defaults when getItem throws', () => {
      storage.getItem = vi.fn(() => { throw new Error('fail'); });
      const result = loadAnimationSettings(storage);
      expect(result).toEqual(ANIMATION_DEFAULTS);
    });

    it('clamps out-of-range values', () => {
      storage.setItem('kukla2d.animation-settings.v1', JSON.stringify({
        version: 1, frameCount: 0, fps: 0, speed: 0,
      }));
      const result = loadAnimationSettings(storage);
      expect(result.frameCount).toBe(1);
      expect(result.fps).toBe(1);
      expect(result.speed).toBe(0.05);
    });

    it('handles partial saved object with defaults fill', () => {
      storage.setItem('kukla2d.animation-settings.v1', JSON.stringify({
        version: 1, fps: 30,
      }));
      const result = loadAnimationSettings(storage);
      expect(result.fps).toBe(30);
      expect(result.frameCount).toBe(48);
      expect(result.speed).toBe(1);
    });
  });

  describe('saveAnimationSettings', () => {
    it('saves settings to storage', () => {
      const result = saveAnimationSettings({ frameCount: 60, fps: 30, speed: 1.5 }, storage);
      expect(result).toEqual({ ok: true });
      expect(storage.setItem).toHaveBeenCalled();
      const saved = JSON.parse(storage.setItem.mock.calls[0][1]);
      expect(saved.version).toBe(1);
      expect(saved.frameCount).toBe(60);
      expect(saved.fps).toBe(30);
      expect(saved.speed).toBe(1.5);
    });

    it('returns error when storage is unavailable', () => {
      const result = saveAnimationSettings(ANIMATION_DEFAULTS, null);
      expect(result).toEqual({ ok: false, code: 'STORAGE_UNAVAILABLE', error: 'Storage unavailable' });
    });

    it('returns error when setItem throws', () => {
      storage.setItem = vi.fn(() => { throw new Error('QuotaExceededError'); });
      const result = saveAnimationSettings(ANIMATION_DEFAULTS, storage);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('QuotaExceededError');
    });

    it('normalizes before saving', () => {
      const result = saveAnimationSettings({ frameCount: 0, fps: 0, speed: 10 }, storage);
      expect(result).toEqual({ ok: true });
      const saved = JSON.parse(storage.setItem.mock.calls[0][1]);
      expect(saved.frameCount).toBe(1);
      expect(saved.fps).toBe(1);
      expect(saved.speed).toBe(4);
    });
  });

  describe('resetAnimationSettings', () => {
    it('removes the key from storage', () => {
      storage.setItem('kukla2d.animation-settings.v1', '{}');
      const result = resetAnimationSettings(storage);
      expect(result).toEqual({ ok: true });
      expect(storage.removeItem).toHaveBeenCalledWith('kukla2d.animation-settings.v1');
    });

    it('returns error when storage is unavailable', () => {
      const result = resetAnimationSettings(null);
      expect(result).toEqual({ ok: false, code: 'STORAGE_UNAVAILABLE', error: 'Storage unavailable' });
    });

    it('returns error when removeItem throws', () => {
      storage.removeItem = vi.fn(() => { throw new Error('Denied'); });
      const result = resetAnimationSettings(storage);
      expect(result.ok).toBe(false);
    });
  });

  describe('safeGlobalStorage', () => {
    it('returns null in non-browser environments', () => {
      const originalWindow = globalThis.window;
      delete globalThis.window;
      try {
        expect(safeGlobalStorage()).toBeNull();
      } finally {
        globalThis.window = originalWindow;
      }
    });

    it('returns null when localStorage access throws', () => {
      const originalWindow = globalThis.window;
      globalThis.window = {};
      try {
        expect(safeGlobalStorage()).toBeNull();
      } finally {
        globalThis.window = originalWindow;
      }
    });
  });
});
