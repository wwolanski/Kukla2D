import { describe, it, expect } from 'vitest';
import { uid } from '@/lib/uid';

describe('uid', () => {
  it('generates 100 unique ids', () => {
    const ids = new Set(Array.from({ length: 100 }, () => uid()));
    expect(ids.size).toBe(100);
  });

  it('returns a string', () => {
    expect(typeof uid()).toBe('string');
  });

  it('generates ids that are alphanumeric', () => {
    const id = uid();
    expect(id).toMatch(/^[a-z0-9]+$/);
  });
});
