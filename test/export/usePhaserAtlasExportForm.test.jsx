// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { usePhaserAtlasExportForm } from '@/features/export/application/usePhaserAtlasExportForm';
import { renderHook } from '../renderHook.jsx';

const project = {
  canvas: { width: 512, height: 512 },
  animations: [
    { id: 'idle', name: 'Idle', duration: 1000, fps: 12 },
    { id: 'walk', name: 'Walk', duration: 2000, fps: 24 },
  ],
};

describe('usePhaserAtlasExportForm', () => {
  it('has phaser_atlas variantId', () => {
    const hook = renderHook(() => usePhaserAtlasExportForm({
      open: true,
      project,
      animStore: { activeAnimationId: 'walk', fps: 24 },
      projectName: 'test-project',
    }));

    expect(hook.result.current.frame.variantId).toBe('phaser_atlas');
  });

  it('defaults to the active animation', () => {
    const hook = renderHook(() => usePhaserAtlasExportForm({
      open: true,
      project,
      animStore: { activeAnimationId: 'walk', fps: 24 },
    }));

    expect(hook.result.current.frame.animTarget).toBe('walk');
    expect(hook.result.current.frame.targetAnims.map(a => a.id)).toEqual(['walk']);
  });

  it('uses R11 defaults: trim=true, padding=2, maxPageSize=2048, loop=true', () => {
    const hook = renderHook(() => usePhaserAtlasExportForm({
      open: true,
      project,
      animStore: { activeAnimationId: 'idle', fps: 12 },
    }));

    expect(hook.result.current.frame.trim).toBe(true);
    expect(hook.result.current.frame.padding).toBe(2);
    expect(hook.result.current.frame.maxPageSize).toBe(2048);
    expect(hook.result.current.frame.loop).toBe(true);
  });

  it('defaults exportDest to folder when showDirectoryPicker exists, else zip', () => {
    const hook = renderHook(() => usePhaserAtlasExportForm({
      open: true,
      project,
      animStore: { activeAnimationId: 'idle', fps: 12 },
    }));

    const hasFolder = typeof window !== 'undefined' && 'showDirectoryPicker' in window;
    expect(hook.result.current.frame.exportDest).toBe(hasFolder ? 'folder' : 'zip');
  });

  it('computes totalFrameCount from selected animations and FPS', () => {
    const hook = renderHook(() => usePhaserAtlasExportForm({
      open: true,
      project,
      animStore: { activeAnimationId: 'idle', fps: 12 },
    }));

    expect(hook.result.current.frame.totalFrameCount).toBe(12);

    act(() => hook.result.current.frame.setAnimTarget('all'));
    expect(hook.result.current.frame.totalFrameCount).toBe(36);
  });

  it('computes estimatedUntrimmedPixels', () => {
    const hook = renderHook(() => usePhaserAtlasExportForm({
      open: true,
      project,
      animStore: { activeAnimationId: 'idle', fps: 12 },
    }));

    expect(hook.result.current.frame.estimatedUntrimmedPixels).toBe(512 * 512 * 12);
  });

  it('exposes cancel and progress status', () => {
    const hook = renderHook(() => usePhaserAtlasExportForm({
      open: true,
      project,
      animStore: { activeAnimationId: 'idle', fps: 12 },
    }));

    expect(hook.result.current.status.isExporting).toBe(false);
    expect(hook.result.current.status.progress).toBeNull();
    expect(hook.result.current.status.exportError).toBeNull();
    expect(typeof hook.result.current.status.setIsExporting).toBe('function');
    expect(typeof hook.result.current.status.setProgress).toBe('function');
    expect(typeof hook.result.current.status.setExportError).toBe('function');
  });
});
