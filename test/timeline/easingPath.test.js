import { describe, it, expect } from 'vitest';
import { buildEasingPath } from '@/features/timeline/components/easingPath';

describe('buildEasingPath', () => {
  it('linear: straight line from y=8 to y=2', () => {
    expect(buildEasingPath({ easing: 'linear', fromPercent: 0, toPercent: 100 }))
      .toBe('M 0 8 L 100 2');
  });

  it('stepped: horizontal then vertical', () => {
    expect(buildEasingPath({ easing: 'stepped', fromPercent: 0, toPercent: 100 }))
      .toBe('M 0 8 L 100 8 L 100 2');
  });

  it('ease-in: cubic bezier with cp1 and cp2 at end', () => {
    expect(buildEasingPath({ easing: 'ease-in', fromPercent: 0, toPercent: 100 }))
      .toBe('M 0 8 C 100 8, 100 8, 100 2');
  });

  it('ease-out: cubic bezier with cp1 and cp2 at start', () => {
    expect(buildEasingPath({ easing: 'ease-out', fromPercent: 0, toPercent: 100 }))
      .toBe('M 0 8 C 0 2, 0 2, 100 2');
  });

  it('ease-both: cubic bezier with symmetric control points', () => {
    expect(buildEasingPath({ easing: 'ease-both', fromPercent: 0, toPercent: 100 }))
      .toBe('M 0 8 C 50 8, 50 2, 100 2');
  });

  it('ease: alias for ease-both', () => {
    expect(buildEasingPath({ easing: 'ease', fromPercent: 0, toPercent: 100 }))
      .toBe('M 0 8 C 50 8, 50 2, 100 2');
  });

  it('unknown easing defaults to ease-both shape', () => {
    expect(buildEasingPath({ easing: 'nieznany', fromPercent: 0, toPercent: 100 }))
      .toBe('M 0 8 C 50 8, 50 2, 100 2');
  });

  it('undefined easing defaults to ease-both shape', () => {
    expect(buildEasingPath({ fromPercent: 0, toPercent: 100 }))
      .toBe('M 0 8 C 50 8, 50 2, 100 2');
  });

  it('works with non-zero fromPercent', () => {
    expect(buildEasingPath({ easing: 'linear', fromPercent: 20, toPercent: 80 }))
      .toBe('M 20 8 L 80 2');
  });
});
