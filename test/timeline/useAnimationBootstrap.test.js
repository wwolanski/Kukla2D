// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '../renderHook.jsx';
import { useAnimationBootstrap } from '@/features/timeline/application/useAnimationBootstrap.js';

describe('useAnimationBootstrap', () => {
  it('returns active clip id when clip already selected', () => {
    const selectClip = vi.fn();
    const createClip = vi.fn();
    const { result } = renderHook(() => useAnimationBootstrap({
      activeClip: { id: 'active-1' },
      animations: [{ id: 'active-1' }],
      selectClip,
      createClip,
    }));

    expect(result.current.ensureAnimation()).toBe('active-1');
    expect(selectClip).not.toHaveBeenCalled();
    expect(createClip).not.toHaveBeenCalled();
  });

  it('selects first animation when timeline has clips but no active clip', () => {
    const selectClip = vi.fn(() => 'anim-1');
    const createClip = vi.fn();
    const { result } = renderHook(() => useAnimationBootstrap({
      activeClip: null,
      animations: [{ id: 'anim-1' }],
      selectClip,
      createClip,
    }));

    expect(result.current.ensureAnimation()).toBe('anim-1');
    expect(selectClip).toHaveBeenCalledWith('anim-1');
    expect(createClip).not.toHaveBeenCalled();
  });

  it('creates clip when timeline is empty', () => {
    const selectClip = vi.fn();
    const createClip = vi.fn(() => ({ affectedIds: ['created-1'] }));
    const { result } = renderHook(() => useAnimationBootstrap({
      activeClip: null,
      animations: [],
      selectClip,
      createClip,
    }));

    expect(result.current.ensureAnimation()).toBe('created-1');
    expect(createClip).toHaveBeenCalled();
    expect(selectClip).not.toHaveBeenCalled();
  });
});
