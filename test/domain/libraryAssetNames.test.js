import { describe, expect, it } from 'vitest';

import { createUniqueName } from '@/domain/libraryAssetNames';

describe('createUniqueName', () => {
  it('uses numbered suffixes without colliding case-insensitively', () => {
    expect(createUniqueName('Right Arm', ['right arm', 'Right Arm (1)', 'RIGHT ARM (2)']))
      .toBe('Right Arm (3)');
  });

  it('keeps an unused name and trims whitespace', () => {
    expect(createUniqueName('  Head  ', ['Body'])).toBe('Head');
  });
});
