import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  createDefaultPixiRuntimeStats,
  createPixiRuntimeStats,
  validatePixiRuntimeCommandTarget,
} from '@/features/canvas/domain/pixiRuntimeContracts.js';
import { createEditorCommand } from '@/features/canvas/domain/workflowContracts.js';

const PROJECT_ROOT = resolve(import.meta.dirname, '../..');

function readSource(relativePath) {
  return readFileSync(resolve(PROJECT_ROOT, relativePath), 'utf8');
}

describe('PixiRuntimeStats contract', () => {
  it('createDefaultPixiRuntimeStats returns zeroed stats', () => {
    const stats = createDefaultPixiRuntimeStats();
    expect(stats).toEqual({
      pointerEventsHandled: 0,
      renderCount: 0,
      gpuUploadCount: 0,
      lastFrameDurationMs: 0,
    });
  });

  it('createPixiRuntimeStats applies overrides', () => {
    const stats = createPixiRuntimeStats({ renderCount: 5, lastFrameDurationMs: 1.5 });
    expect(stats.renderCount).toBe(5);
    expect(stats.lastFrameDurationMs).toBe(1.5);
    expect(stats.pointerEventsHandled).toBe(0);
    expect(stats.gpuUploadCount).toBe(0);
  });
});

describe('validatePixiRuntimeCommandTarget', () => {
  it('returns null for valid target', () => {
    const target = {
      bind: () => Promise.resolve(),
      destroy: () => {},
      renderFrame: () => {},
      updateOverlayFrame: () => {},
      executeCommand: () => {},
      readPreviewPoseOverrides: () => null,
      measureStats: () => createDefaultPixiRuntimeStats(),
    };
    expect(validatePixiRuntimeCommandTarget(target)).toBeNull();
  });

  it('returns errors for non-object', () => {
    expect(validatePixiRuntimeCommandTarget(null)).toEqual(['target must be an object']);
    expect(validatePixiRuntimeCommandTarget(undefined)).toEqual(['target must be an object']);
    expect(validatePixiRuntimeCommandTarget(42)).toEqual(['target must be an object']);
  });

  it('returns errors for missing methods', () => {
    const target = {};
    const errors = validatePixiRuntimeCommandTarget(target);
    expect(errors).toContain('bind must be a function');
    expect(errors).toContain('destroy must be a function');
    expect(errors).toContain('renderFrame must be a function');
    expect(errors).toContain('updateOverlayFrame must be a function');
    expect(errors).toContain('executeCommand must be a function');
    expect(errors).toContain('readPreviewPoseOverrides must be a function');
    expect(errors).toContain('measureStats must be a function');
  });

  it('returns errors for partial target', () => {
    const target = {
      bind: () => Promise.resolve(),
      destroy: () => {},
    };
    const errors = validatePixiRuntimeCommandTarget(target);
    expect(errors.length).toBe(5);
    expect(errors).not.toContain('bind must be a function');
    expect(errors).not.toContain('destroy must be a function');
  });

  it('accepts target with extra properties', () => {
    const target = {
      bind: () => Promise.resolve(),
      destroy: () => {},
      renderFrame: () => {},
      updateOverlayFrame: () => {},
      executeCommand: () => {},
      readPreviewPoseOverrides: () => null,
      measureStats: () => createDefaultPixiRuntimeStats(),
      extraMethod: () => {},
    };
    expect(validatePixiRuntimeCommandTarget(target)).toBeNull();
  });
});

describe('domain contract purity', () => {
  it('workflowContracts does not import React', () => {
    const src = readSource('src/features/canvas/domain/workflowContracts.ts');
    expect(src).not.toMatch(/from\s+['"]react['"]/);
    expect(src).not.toMatch(/require\(['"]react['"]\)/);
  });

  it('workflowContracts does not import Zustand', () => {
    const src = readSource('src/features/canvas/domain/workflowContracts.ts');
    expect(src).not.toMatch(/from\s+['"]zustand/);
    expect(src).not.toMatch(/require\(['"]zustand/);
  });

  it('workflowContracts does not import Pixi', () => {
    const src = readSource('src/features/canvas/domain/workflowContracts.ts');
    expect(src).not.toMatch(/from\s+['"]pixi/);
    expect(src).not.toMatch(/require\(['"]pixi/);
  });

  it('pixiRuntimeContracts does not import React', () => {
    const src = readSource('src/features/canvas/domain/pixiRuntimeContracts.ts');
    expect(src).not.toMatch(/from\s+['"]react['"]/);
    expect(src).not.toMatch(/require\(['"]react['"]\)/);
  });

  it('pixiRuntimeContracts does not import Zustand', () => {
    const src = readSource('src/features/canvas/domain/pixiRuntimeContracts.ts');
    expect(src).not.toMatch(/from\s+['"]zustand/);
    expect(src).not.toMatch(/require\(['"]zustand/);
  });

  it('pixiRuntimeContracts does not import Pixi', () => {
    const src = readSource('src/features/canvas/domain/pixiRuntimeContracts.ts');
    expect(src).not.toMatch(/from\s+['"]pixi/);
    expect(src).not.toMatch(/require\(['"]pixi/);
  });

  it('createEditorCommand is usable without runtime deps', () => {
    const cmd = createEditorCommand('beginBatch', { reason: 'test' });
    expect(cmd.type).toBe('beginBatch');
    expect(cmd.payload).toEqual({ reason: 'test' });
  });
});
