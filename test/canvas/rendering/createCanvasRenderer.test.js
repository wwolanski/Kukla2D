// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('createCanvasRenderer', () => {
  let createCanvasRenderer;

  beforeEach(async () => {
    vi.resetModules();
    vi.doMock('@/features/canvas/infrastructure/rendering/pixi/createPixiSceneGateway.js', () => ({
      createPixiSceneGateway: vi.fn(() => ({
        draw: vi.fn(),
        uploadTexture: vi.fn(),
        uploadMesh: vi.fn(),
        uploadQuadFallback: vi.fn(),
        uploadPositions: vi.fn(),
        createInteractionSystem: vi.fn(),
        hasTexture: vi.fn(() => false),
        hasMesh: vi.fn(() => false),
        capture: vi.fn(() => null),
        resize: vi.fn(),
        dispose: vi.fn(),
        ready: Promise.resolve(),
      })),
    }));
      const mod = await import('@/features/canvas/infrastructure/rendering/createCanvasRenderer.js');
    createCanvasRenderer = mod.createCanvasRenderer;
  });

  afterEach(() => {
    vi.doUnmock('@/features/canvas/infrastructure/rendering/pixi/createPixiSceneGateway.js');
    vi.resetModules();
  });

  it('returns gateway with contract methods', () => {
    const mockCanvas = {};
    const g = createCanvasRenderer({ canvas: mockCanvas, onViewChange: vi.fn(), initialView: null });
    expect(typeof g.draw).toBe('function');
    expect(typeof g.dispose).toBe('function');
    expect(typeof g.resize).toBe('function');
    expect(typeof g.capture).toBe('function');
  });

  it('default creates pixi gateway', () => {
    const mockCanvas = {};
    const g = createCanvasRenderer({ canvas: mockCanvas, onViewChange: vi.fn(), initialView: null });
    expect(typeof g.draw).toBe('function');
    expect(typeof g.dispose).toBe('function');
  });
});
