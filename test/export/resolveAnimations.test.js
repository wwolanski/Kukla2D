import { describe, it, expect } from 'vitest';
import { resolveAnimations } from '@/io/resolveAnimations.js';

describe('resolveAnimations', () => {
  const animations = [
    { id: 'idle', name: 'Idle', duration: 1000 },
    { id: 'wave', name: 'Wave', duration: 1500 },
  ];

  it('returns staging placeholder', () => {
    expect(resolveAnimations(animations, 'staging', 'idle')).toEqual([
      { id: 'staging', name: 'staging', duration: 0 },
    ]);
  });

  it('returns active animation for current target', () => {
    expect(resolveAnimations(animations, 'current', 'wave')).toEqual([animations[1]]);
  });

  it('falls back to first animation for current target', () => {
    expect(resolveAnimations(animations, 'current', 'missing')).toEqual([animations[0]]);
  });

  it('returns empty list for current target when animations empty', () => {
    expect(resolveAnimations([], 'current', 'missing')).toEqual([]);
  });

  it('returns all animations for all target', () => {
    expect(resolveAnimations(animations, 'all', 'missing')).toBe(animations);
  });

  it('returns specific animation when target matches id', () => {
    expect(resolveAnimations(animations, 'wave', 'idle')).toEqual([animations[1]]);
  });

  it('returns empty list when specific animation missing', () => {
    expect(resolveAnimations(animations, 'unknown', 'idle')).toEqual([]);
  });
});
