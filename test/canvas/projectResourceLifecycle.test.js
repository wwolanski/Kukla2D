import { describe, expect, it, vi, afterEach } from 'vitest';
import { createProjectResourceOwner } from '../../src/platform/projectResourceOwner';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createProjectResourceOwner', () => {
  it('tracks and revokes URLs on dispose', () => {
    const revokeSpy = vi.fn();
    vi.stubGlobal('URL', { revokeObjectURL: revokeSpy, createObjectURL: () => 'blob://x' });

    const owner = createProjectResourceOwner();
    owner.track('blob://a');
    owner.track('blob://b');
    expect(owner.size).toBe(2);

    owner.dispose();
    expect(revokeSpy).toHaveBeenCalledTimes(2);
    expect(revokeSpy).toHaveBeenCalledWith('blob://a');
    expect(revokeSpy).toHaveBeenCalledWith('blob://b');
  });

  it('dispose is idempotent', () => {
    const revokeSpy = vi.fn();
    vi.stubGlobal('URL', { revokeObjectURL: revokeSpy });

    const owner = createProjectResourceOwner();
    owner.track('blob://a');
    owner.dispose();
    owner.dispose();
    owner.dispose();

    expect(revokeSpy).toHaveBeenCalledTimes(1);
  });

  it('track after dispose immediately revokes', () => {
    const revokeSpy = vi.fn();
    vi.stubGlobal('URL', { revokeObjectURL: revokeSpy });

    const owner = createProjectResourceOwner();
    owner.dispose();
    owner.track('blob://late');

    expect(revokeSpy).toHaveBeenCalledWith('blob://late');
  });

  it('transferOut returns URLs and clears internal list', () => {
    const revokeSpy = vi.fn();
    vi.stubGlobal('URL', { revokeObjectURL: revokeSpy });

    const owner = createProjectResourceOwner();
    owner.track('blob://a');
    owner.track('blob://b');

    const transferred = owner.transferOut();
    expect(transferred).toEqual(['blob://a', 'blob://b']);
    expect(owner.size).toBe(0);

    owner.dispose();
    expect(revokeSpy).not.toHaveBeenCalled();
  });

  it('swap pattern: old owner disposed after new owner takes over', () => {
    const revokeSpy = vi.fn();
    vi.stubGlobal('URL', { revokeObjectURL: revokeSpy });

    const oldOwner = createProjectResourceOwner();
    oldOwner.track('blob://old1');
    oldOwner.track('blob://old2');

    const newOwner = createProjectResourceOwner();
    newOwner.track('blob://new1');

    oldOwner.dispose();
    expect(revokeSpy).toHaveBeenCalledTimes(2);
    expect(revokeSpy).toHaveBeenCalledWith('blob://old1');
    expect(revokeSpy).toHaveBeenCalledWith('blob://old2');

    newOwner.dispose();
    expect(revokeSpy).toHaveBeenCalledTimes(3);
    expect(revokeSpy).toHaveBeenCalledWith('blob://new1');
  });
});
