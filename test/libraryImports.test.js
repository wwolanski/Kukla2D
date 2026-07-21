import { describe, it, expect } from 'vitest';
import { setup } from 'xstate';
import { useMachine } from '@xstate/react';
import { mat3 } from 'gl-matrix';
import { produceWithPatches, applyPatches } from 'immer';
import '../src/store/immerPatches.js';

describe('library imports', () => {
  it('imports xstate setup', () => {
    expect(typeof setup).toBe('function');
  });

  it('imports @xstate/react useMachine', () => {
    expect(typeof useMachine).toBe('function');
  });

  it('imports gl-matrix mat3', () => {
    expect(typeof mat3.create).toBe('function');
    expect(typeof mat3.multiply).toBe('function');
    expect(typeof mat3.invert).toBe('function');
  });

  it('imports immer produceWithPatches and applyPatches', () => {
    expect(typeof produceWithPatches).toBe('function');
    expect(typeof applyPatches).toBe('function');
  });

  it('enablePatches runs without error via immerPatches module', () => {
    const state = { count: 1 };
    const [next, patches, inversePatches] = produceWithPatches(state, (draft) => {
      draft.count = 2;
    });
    expect(next.count).toBe(2);
    expect(patches.length).toBeGreaterThan(0);
    expect(inversePatches.length).toBeGreaterThan(0);

    const restored = applyPatches(next, inversePatches);
    expect(restored.count).toBe(1);
  });
});
