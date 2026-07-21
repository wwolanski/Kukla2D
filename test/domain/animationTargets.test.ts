import { describe, expect, it } from 'vitest';
import {
  findTarget,
  getDefaultValue,
  getTargetsByKind,
  inferTargetKind,
} from '@/domain/animationTargets';

describe('inferTargetKind', () => {
  it('returns node for part type', () => {
    expect(inferTargetKind({ type: 'part', id: 'p1' })).toBe('node');
  });

  it('returns node for group type', () => {
    expect(inferTargetKind({ type: 'group', id: 'g1' })).toBe('node');
  });

  it('returns node for warpDeformer type', () => {
    expect(inferTargetKind({ type: 'warpDeformer', id: 'w1' })).toBe('node');
  });

  it('returns bone when setup and parentId exist without length', () => {
    expect(inferTargetKind({ id: 'b1', setup: {}, parentId: 'root' })).toBe('bone');
  });

  it('returns constraint for ik type', () => {
    expect(inferTargetKind({ type: 'ik', id: 'c1' })).toBe('constraint');
  });

  it('returns slot when boneId and id exist without setup', () => {
    expect(inferTargetKind({ id: 's1', boneId: 'b1' })).toBe('slot');
  });

  it('returns null for null input', () => {
    expect(inferTargetKind(null)).toBeNull();
  });

  it('returns null for unknown shape', () => {
    expect(inferTargetKind({ id: 'x' })).toBeNull();
  });
});

describe('getDefaultValue', () => {
  it('returns 1 for opacity', () => {
    expect(getDefaultValue('opacity', 'node')).toBe(1);
  });

  it('returns true for visible', () => {
    expect(getDefaultValue('visible', 'node')).toBe(true);
  });

  it('returns 0 for targetX/targetY', () => {
    expect(getDefaultValue('targetX', 'bone')).toBe(0);
    expect(getDefaultValue('targetY', 'bone')).toBe(0);
  });

  it('returns 1 for bone scaleX/scaleY', () => {
    expect(getDefaultValue('scaleX', 'bone')).toBe(1);
    expect(getDefaultValue('scaleY', 'bone')).toBe(1);
  });

  it('returns 0 for bone rotation', () => {
    expect(getDefaultValue('rotation', 'bone')).toBe(0);
  });

  it('returns 0 for blendShape properties', () => {
    expect(getDefaultValue('blendShape:mouth', 'node')).toBe(0);
  });

  it('returns 0 for drawOrder', () => {
    expect(getDefaultValue('drawOrder', 'slot')).toBe(0);
  });
});

describe('findTarget', () => {
  const project = {
    nodes: [{ id: 'n1', type: 'part' }],
    bones: [{ id: 'b1' }],
    constraints: [{ id: 'c1' }],
    slots: [{ id: 's1', boneId: 'b1' }],
  };

  it('finds a node by id', () => {
    expect(findTarget(project, 'n1')).toEqual({ id: 'n1', type: 'part' });
  });

  it('finds a bone by id', () => {
    expect(findTarget(project, 'b1')).toEqual({ id: 'b1' });
  });

  it('finds a constraint by id', () => {
    expect(findTarget(project, 'c1')).toEqual({ id: 'c1' });
  });

  it('returns null for missing id', () => {
    expect(findTarget(project, 'missing')).toBeNull();
  });

  it('returns null for null project', () => {
    expect(findTarget(null, 'n1')).toBeNull();
  });
});

describe('getTargetsByKind', () => {
  const project = {
    nodes: [{ id: 'n1' }, { id: 'n2' }],
    bones: [{ id: 'b1' }],
    constraints: [{ id: 'c1' }],
    slots: [{ id: 's1', boneId: 'b1' }],
  };

  it('returns node ids', () => {
    expect(getTargetsByKind(project, 'node')).toEqual(['n1', 'n2']);
  });

  it('returns bone ids', () => {
    expect(getTargetsByKind(project, 'bone')).toEqual(['b1']);
  });

  it('returns empty for null project', () => {
    expect(getTargetsByKind(null, 'node')).toEqual([]);
  });

  it('returns empty for unknown kind', () => {
    expect(getTargetsByKind(project, 'unknown')).toEqual([]);
  });
});
