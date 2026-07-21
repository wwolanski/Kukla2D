import { describe, expect, it } from 'vitest';
import { getNextBoneName } from '@/features/canvas/domain/boneNaming.js';

describe('getNextBoneName', () => {
  it('uses the highest numeric name instead of array length', () => {
    const bones = [
      { name: 'Bone 1' },
      { name: 'Bone 8' },
      { name: 'Arm' },
    ];
    expect(getNextBoneName(bones)).toBe('Bone 9');
  });

  it('never duplicates an occupied generated name', () => {
    const bones = Array.from({ length: 8 }, (_, index) => ({ name: `Bone ${index + 1}` }));
    bones.splice(3, 1);
    expect(getNextBoneName(bones)).toBe('Bone 9');
  });
});
