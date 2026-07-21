import { describe, expect, it } from 'vitest';
import {
  ANIMATION_DEFAULTS,
  ANIMATION_SETTING_LIMITS,
  normalizeAnimationSettings,
  durationMsFromFrameCount,
} from '../../src/domain/animationDefaults.js';

describe('animationDefaults', () => {
  describe('ANIMATION_DEFAULTS', () => {
    it('has canonical built-in values', () => {
      expect(ANIMATION_DEFAULTS).toEqual({ frameCount: 48, fps: 24, speed: 1 });
    });

    it('is frozen', () => {
      expect(Object.isFrozen(ANIMATION_DEFAULTS)).toBe(true);
    });
  });

  describe('ANIMATION_SETTING_LIMITS', () => {
    it('defines frameCount limits', () => {
      expect(ANIMATION_SETTING_LIMITS.frameCount).toEqual({ min: 1, max: 100000 });
    });

    it('defines fps limits', () => {
      expect(ANIMATION_SETTING_LIMITS.fps).toEqual({ min: 1, max: 120 });
    });

    it('defines speed limits', () => {
      expect(ANIMATION_SETTING_LIMITS.speed).toEqual({ min: 0.05, max: 4 });
    });
  });

  describe('normalizeAnimationSettings', () => {
    it('returns defaults for null/undefined', () => {
      expect(normalizeAnimationSettings(null)).toEqual(ANIMATION_DEFAULTS);
      expect(normalizeAnimationSettings(undefined)).toEqual(ANIMATION_DEFAULTS);
    });

    it('returns defaults for non-object', () => {
      expect(normalizeAnimationSettings('bad')).toEqual(ANIMATION_DEFAULTS);
      expect(normalizeAnimationSettings(42)).toEqual(ANIMATION_DEFAULTS);
    });

    it('passes through valid values', () => {
      const result = normalizeAnimationSettings({ frameCount: 60, fps: 30, speed: 1.5 });
      expect(result.frameCount).toBe(60);
      expect(result.fps).toBe(30);
      expect(result.speed).toBe(1.5);
    });

    it('clamps frameCount to min', () => {
      expect(normalizeAnimationSettings({ frameCount: 0 }).frameCount).toBe(1);
    });

    it('clamps frameCount to max', () => {
      expect(normalizeAnimationSettings({ frameCount: 200000 }).frameCount).toBe(100000);
    });

    it('clamps fps to min', () => {
      expect(normalizeAnimationSettings({ fps: 0 }).fps).toBe(1);
    });

    it('clamps fps to max', () => {
      expect(normalizeAnimationSettings({ fps: 200 }).fps).toBe(120);
    });

    it('clamps speed to min', () => {
      expect(normalizeAnimationSettings({ speed: 0 }).speed).toBe(0.05);
    });

    it('clamps speed to max', () => {
      expect(normalizeAnimationSettings({ speed: 10 }).speed).toBe(4);
    });

    it('rounds speed to 0.05 step', () => {
      expect(normalizeAnimationSettings({ speed: 1.23 }).speed).toBe(1.25);
      expect(normalizeAnimationSettings({ speed: 1.27 }).speed).toBe(1.25);
    });

    it('rounds frameCount to integer', () => {
      expect(normalizeAnimationSettings({ frameCount: 48.7 }).frameCount).toBe(49);
    });

    it('rounds fps to integer', () => {
      expect(normalizeAnimationSettings({ fps: 29.7 }).fps).toBe(30);
    });

    it('handles partial input — fills missing from defaults', () => {
      const result = normalizeAnimationSettings({ fps: 30 });
      expect(result.fps).toBe(30);
      expect(result.frameCount).toBe(48);
      expect(result.speed).toBe(1);
    });

    it('handles NaN input values', () => {
      const result = normalizeAnimationSettings({ frameCount: NaN, fps: NaN, speed: NaN });
      expect(result).toEqual(ANIMATION_DEFAULTS);
    });

    it('handles Infinity input values', () => {
      const result = normalizeAnimationSettings({ frameCount: Infinity, fps: -Infinity, speed: Infinity });
      expect(result).toEqual(ANIMATION_DEFAULTS);
    });

    it('handles string number input', () => {
      const result = normalizeAnimationSettings({ frameCount: '60', fps: '30', speed: '1.5' });
      expect(result).toEqual(ANIMATION_DEFAULTS);
    });

    it('does not mutate original object', () => {
      const input = { frameCount: 60, fps: 30 };
      const result = normalizeAnimationSettings(input);
      expect(result.frameCount).toBe(60);
      expect(input).toEqual({ frameCount: 60, fps: 30 });
    });
  });

  describe('durationMsFromFrameCount', () => {
    it('computes duration for 48 frames at 24 fps', () => {
      expect(durationMsFromFrameCount(48, 24)).toBe(2000);
    });

    it('computes duration for 30 frames at 30 fps', () => {
      expect(durationMsFromFrameCount(30, 30)).toBe(1000);
    });

    it('returns fallback for zero fps', () => {
      const result = durationMsFromFrameCount(48, 0);
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThan(0);
    });

    it('returns fallback for non-finite inputs', () => {
      const result = durationMsFromFrameCount(NaN, NaN);
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThan(0);
    });
  });
});
