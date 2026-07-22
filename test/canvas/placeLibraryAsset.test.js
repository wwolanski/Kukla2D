import { describe, expect, it, vi } from 'vitest';
import { placeLibraryAsset } from '@/features/canvas/application/placeLibraryAsset.js';

describe('placeLibraryAsset', () => {
  it('adds a canvas part that references existing library texture without duplicating it', async () => {
    const project = {
      textures: [{ id: 'asset-1', source: 'data:image/png;base64,asset', fileName: 'asset.png' }],
      nodes: [{
        id: 'asset-1', type: 'part', name: 'Asset', parent: null, draw_order: 0,
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      }],
    };
    const updateProject = vi.fn(mutator => mutator(project));

    const placed = await placeLibraryAsset({
      assetId: 'asset-1',
      event: { clientX: 110, clientY: 70 },
      projectRef: { current: project },
      canvasRef: { current: { getBoundingClientRect: () => ({ left: 10, top: 20 }) } },
      editorRef: { current: { view: { zoom: 2, panX: 20, panY: 10 } } },
      updateProject,
      markDirty: vi.fn(),
    });

    expect(placed).toBe(true);
    expect(project.textures).toHaveLength(1);
    expect(project.nodes).toHaveLength(2);
    expect(project.nodes[1]).toMatchObject({
      type: 'part',
      textureId: 'asset-1',
      parent: null,
      draw_order: 1,
      transform: expect.objectContaining({ x: 40, y: 20 }),
    });
  });

  it('recreates a deleted library asset from its texture', async () => {
    const OriginalImage = globalThis.Image;
    globalThis.Image = class {
      width = 80;
      height = 40;

      set src(_value) {
        this.onload();
      }
    };
    const project = {
      textures: [{ id: 'asset-1', source: 'data:image/png;base64,asset', fileName: 'asset.png' }],
      nodes: [],
    };
    try {
      const placed = await placeLibraryAsset({
        assetId: 'asset-1',
        event: { clientX: 10, clientY: 20 },
        projectRef: { current: project },
        canvasRef: { current: { getBoundingClientRect: () => ({ left: 0, top: 0 }) } },
        editorRef: { current: { view: { zoom: 1, panX: 0, panY: 0 } } },
        updateProject: mutator => mutator(project),
        markDirty: vi.fn(),
      });

      expect(placed).toBe(true);
      expect(project.nodes[0]).toMatchObject({
        type: 'part',
        textureId: 'asset-1',
        imageWidth: 80,
        imageHeight: 40,
      });
    } finally {
      globalThis.Image = OriginalImage;
    }
  });

  it('primes GPU texture before the new part can render its fallback mesh', async () => {
    const project = {
      textures: [{ id: 'asset-1', source: 'data:image/png;base64,asset', fileName: 'asset.png' }],
      nodes: [{
        id: 'asset-1', type: 'part', name: 'Asset', parent: null, draw_order: 0,
        imageWidth: 20, imageHeight: 10,
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      }],
    };
    const imageData = { width: 20, height: 10 };
    const gateway = { uploadTexture: vi.fn(), uploadQuadFallback: vi.fn() };
    const textureCache = { __internal: {
      imageDataByPartId: new Map([['asset-1', imageData]]),
      lastUploadedSources: new Map(),
    }};

    await placeLibraryAsset({
      assetId: 'asset-1',
      event: { clientX: 10, clientY: 20 },
      projectRef: { current: project },
      canvasRef: { current: { getBoundingClientRect: () => ({ left: 0, top: 0 }) } },
      editorRef: { current: { view: { zoom: 1, panX: 0, panY: 0 } } },
      updateProject: mutator => mutator(project),
      markDirty: vi.fn(),
      sceneGatewayRef: { current: gateway },
      textureCache,
    });

    expect(gateway.uploadTexture).toHaveBeenCalledWith(project.nodes[1].id, imageData);
    expect(gateway.uploadQuadFallback).toHaveBeenCalledWith(project.nodes[1].id, 20, 10);
    expect(textureCache.__internal.imageDataByPartId.get(project.nodes[1].id)).toBe(imageData);
  });

  it('copies alpha-picking data when a Library-only texture is placed on canvas', async () => {
    const OriginalImage = globalThis.Image;
    globalThis.Image = class {
      width = 80;
      height = 40;
      set src(_value) { this.onload(); }
    };
    const project = {
      textures: [{ id: 'asset-1', source: 'data:image/png;base64,asset', fileName: 'asset.png' }],
      nodes: [],
    };
    const sourcePixels = new Uint8ClampedArray(80 * 40 * 4);
    for (let y = 10; y < 30; y++) {
      for (let x = 20; x < 60; x++) sourcePixels[(y * 80 + x) * 4 + 3] = 255;
    }
    const sourceImageData = {
      width: 80,
      height: 40,
      data: sourcePixels,
    };
    const textureCache = { __internal: {
      imageDataByPartId: new Map([['asset-1', sourceImageData]]),
      lastUploadedSources: new Map(),
    }};
    const gateway = { uploadTexture: vi.fn(), uploadQuadFallback: vi.fn() };

    try {
      await placeLibraryAsset({
        assetId: 'asset-1',
        event: { clientX: 10, clientY: 20 },
        projectRef: { current: project },
        canvasRef: { current: { getBoundingClientRect: () => ({ left: 0, top: 0 }) } },
        editorRef: { current: { view: { zoom: 1, panX: 0, panY: 0 } } },
        updateProject: mutator => mutator(project),
        sceneGatewayRef: { current: gateway },
        textureCache,
      });

      const placedId = project.nodes[0].id;
      expect(placedId).not.toBe('asset-1');
      expect(textureCache.__internal.imageDataByPartId.get(placedId)).toBe(sourceImageData);
      expect(project.nodes[0].imageBounds).toEqual({ minX: 20, minY: 10, maxX: 59, maxY: 29 });
      expect(project.nodes[0].alphaContours.length).toBeGreaterThan(0);
    } finally {
      globalThis.Image = OriginalImage;
    }
  });
});
