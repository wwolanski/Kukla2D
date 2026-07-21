// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { useRasterExportForm } from '@/features/export/application/useRasterExportForm';
import { renderHook } from '../renderHook.jsx';

const project = {
  canvas: { width: 512, height: 512 },
  animations: [
    { id: 'idle', name: 'Idle', duration: 1000, fps: 12 },
    { id: 'walk', name: 'Walk', duration: 2000, fps: 24 },
  ],
};

describe('useRasterExportForm', () => {
  it('defaults to the active animation without a Current pseudo-option', () => {
    const hook = renderHook(() => useRasterExportForm({
      open: true,
      project,
      animStore: { activeAnimationId: 'walk', fps: 24 },
    }));

    expect(hook.result.current.frame.animTarget).toBe('walk');
    expect(hook.result.current.frame.targetAnims.map(animation => animation.id)).toEqual(['walk']);
  });

  it('keeps type and format compatible', () => {
    const hook = renderHook(() => useRasterExportForm({
      open: true,
      project,
      animStore: { activeAnimationId: 'idle', fps: 12 },
    }));

    act(() => hook.result.current.frame.setType('animation'));
    expect(hook.result.current.frame.format).toBe('gif');
    expect(hook.result.current.frame.variantId).toBe('gif');

    act(() => hook.result.current.frame.setType('spritesheet'));
    expect(hook.result.current.frame.format).toBe('png');
    expect(hook.result.current.frame.variantId).toBe('png_spritesheet');
  });

  it('defaults single-artifact exports to one file and multi-artifact exports to ZIP', () => {
    const hook = renderHook(() => useRasterExportForm({
      open: true,
      project,
      animStore: { activeAnimationId: 'idle', fps: 12 },
    }));

    act(() => hook.result.current.frame.setType('spritesheet'));
    expect(hook.result.current.frame.expectedArtifactCount).toBe(1);
    expect(hook.result.current.frame.exportDest).toBe('download');

    act(() => hook.result.current.frame.setAnimTarget('all'));
    expect(hook.result.current.frame.expectedArtifactCount).toBe(2);
    expect(hook.result.current.frame.exportDest).toBe('zip');
  });
});
