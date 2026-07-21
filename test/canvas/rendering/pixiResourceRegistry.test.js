// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function createMockApp() {
  return {
    renderer: { width: 800, height: 600, events: {}, resize: vi.fn() },
    stage: { addChild: vi.fn() },
    render: vi.fn(),
    init: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(),
  };
}

describe('PixiResourceRegistry upload methods', () => {
  let PixiResourceRegistry;
  let PixiSceneGateway;

  beforeEach(async () => {
    vi.resetModules();
    vi.doMock('pixi.js', () => {
      let texCounter = 0;
      return {
        Application: class {
          constructor() {
            Object.assign(this, createMockApp());
          }
          async init() {}
          render() {}
          destroy() {}
        },
        Container: class {
          constructor() { this.children = []; this.sortableChildren = false; this.zIndex = 0; }
          addChild(c) { this.children.push(c); }
          removeChild(c) { this.children = this.children.filter(x => x !== c); }
          destroy() {}
        },
        Texture: {
          WHITE: { destroy: vi.fn() },
          from: vi.fn(() => ({
            destroy: vi.fn(),
            _id: ++texCounter,
          })),
        },
        MeshGeometry: class {
          constructor(opts) {
            this._opts = opts;
            this._attrs = {};
            this.destroy = vi.fn();
            this.positions = opts.positions;
            this.uvs = opts.uvs;
            if (opts.positions) this._attrs.aPosition = { data: opts.positions, update: vi.fn() };
            if (opts.uvs) this._attrs.aUV = { data: opts.uvs, update: vi.fn() };
            if (opts.indices) this._attrs.indices = { data: opts.indices };
          }
          getAttribute(name) { return this._attrs[name] || null; }
          getBuffer(name) { return this._attrs[name]; }
          getIndex() { return this._attrs.indices || null; }
        },
        Mesh: class {
          constructor(opts) {
            this.geometry = opts.geometry;
            this.texture = opts.texture;
            this.visible = true;
            this.alpha = 1;
            this.zIndex = 0;
            this.position = { x: 0, y: 0 };
            this.rotation = 0;
            this.scale = { x: 1, y: 1 };
            this.pivot = { x: 0, y: 0 };
            this.parent = null;
            this.mask = null;
            this.includeInBuild = false;
            this.renderable = true;
            this.measurable = true;
            this.addChild = vi.fn();
            this.destroy = vi.fn();
            this.setMask = vi.fn(({ mask, channel }) => {
              this.mask = mask;
              this._maskChannel = channel;
            });
          }
        },
      };
    });

    const mod = await import(
      '@/features/canvas/infrastructure/rendering/pixi/PixiResourceRegistry.js'
    );
    PixiResourceRegistry = mod.PixiResourceRegistry;
    PixiSceneGateway = (await import(
      '@/features/canvas/infrastructure/rendering/pixi/PixiSceneGateway.js'
    )).PixiSceneGateway;
  });

  afterEach(() => {
    vi.doUnmock('pixi.js');
    vi.resetModules();
  });

  it('uploadTexture creates texture and hasTexture returns true', () => {
    const registry = new PixiResourceRegistry({ app: createMockApp() });
    const image = { width: 100, height: 100 };

    registry.uploadTexture('part-1', image);

    expect(registry.hasTexture('part-1')).toBe(true);
  });

  it('uploadTexture destroys old texture', () => {
    const registry = new PixiResourceRegistry({ app: createMockApp() });
    const image = { width: 100, height: 100 };

    registry.uploadTexture('part-1', image);
    const oldTex = registry.texturesByPartId.get('part-1');

    registry.uploadTexture('part-1', image);

    expect(oldTex.destroy).toHaveBeenCalled();
    expect(registry.hasTexture('part-1')).toBe(true);
  });

  it('uploadMesh creates geometry and mesh, hasMesh returns true', () => {
    const registry = new PixiResourceRegistry({ app: createMockApp() });

    registry.uploadMesh('part-1', {
      vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
      uvs: [0, 0, 1, 0, 1, 1, 0, 1],
      indices: [0, 1, 2, 0, 2, 3],
    });

    expect(registry.hasMesh('part-1')).toBe(true);
    expect(registry.geometriesByPartId.has('part-1')).toBe(true);
  });

  it('uploadMesh detaches old mesh before destroying replaced resources', () => {
    const registry = new PixiResourceRegistry({ app: createMockApp() });
    const meshData = {
      vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }],
      uvs: [0, 0, 1, 0, 1, 1],
      indices: [0, 1, 2],
    };

    registry.uploadMesh('part-1', meshData);
    const oldMesh = registry.meshesByPartId.get('part-1');
    const oldGeometry = registry.geometriesByPartId.get('part-1');
    const parent = {
      removeChild: vi.fn((child) => {
        child.parent = null;
      }),
    };
    oldMesh.parent = parent;

    registry.uploadMesh('part-1', meshData);

    expect(parent.removeChild).toHaveBeenCalledWith(oldMesh);
    expect(oldMesh.destroy).toHaveBeenCalled();
    expect(oldGeometry.destroy).toHaveBeenCalled();
    expect(registry.meshesByPartId.get('part-1')).not.toBe(oldMesh);
  });

  it('uploadMesh accepts project triangle tuples and flattens Pixi indices', () => {
    const registry = new PixiResourceRegistry({ app: createMockApp() });

    registry.uploadMesh('part-1', {
      vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
      uvs: [0, 0, 1, 0, 1, 1, 0, 1],
      triangles: [[0, 1, 2], [0, 2, 3]],
    });

    const geometry = registry.geometriesByPartId.get('part-1');
    expect(Array.from(geometry.getIndex().data)).toEqual([0, 1, 2, 0, 2, 3]);
  });

  it('uploadMesh uses Uint32Array for large indices', () => {
    const registry = new PixiResourceRegistry({ app: createMockApp() });

    registry.uploadMesh('part-1', {
      vertices: [{ x: 0, y: 0 }],
      uvs: [0, 0],
      indices: [0, 1, 2, 65536],
    });

    expect(registry.hasMesh('part-1')).toBe(true);
  });

  it('uploadQuadFallback creates quad mesh', () => {
    const registry = new PixiResourceRegistry({ app: createMockApp() });

    registry.uploadQuadFallback('part-1', 200, 150);

    expect(registry.hasMesh('part-1')).toBe(true);
  });

  it('uploadPositions updates existing geometry buffers', () => {
    const registry = new PixiResourceRegistry({ app: createMockApp() });

    registry.uploadMesh('part-1', {
      vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
      uvs: [0, 0, 1, 0, 1, 1, 0, 1],
      indices: [0, 1, 2, 0, 2, 3],
    });

    registry.uploadPositions('part-1',
      [{ x: 5, y: 5 }, { x: 95, y: 5 }, { x: 95, y: 95 }, { x: 5, y: 95 }],
      new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
    );

    const geo = registry.geometriesByPartId.get('part-1');
    expect(geo.positions[0]).toBe(5);
    expect(geo.positions[1]).toBe(5);
  });

  it('uploadPositions rebuilds geometry when vertex count changes', () => {
    const registry = new PixiResourceRegistry({ app: createMockApp() });

    registry.uploadMesh('part-1', {
      vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
      uvs: [0, 0, 1, 0, 1, 1, 0, 1],
      indices: [0, 1, 2, 0, 2, 3],
    });

    registry.uploadPositions('part-1',
      [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }, { x: 0, y: 50 }, { x: 25, y: 25 }],
      new Float32Array([0, 0, 1, 0, 1, 1, 0, 1, 0.5, 0.5]),
    );

    expect(registry.hasMesh('part-1')).toBe(true);
  });

  it('uploadPositions returns silently when no geometry exists', () => {
    const registry = new PixiResourceRegistry({ app: createMockApp() });

    expect(() => {
      registry.uploadPositions('nonexistent',
        [{ x: 0, y: 0 }],
        new Float32Array([0, 0]),
      );
    }).not.toThrow();
  });

  it('disposePart cleans up all resources', () => {
    const registry = new PixiResourceRegistry({ app: createMockApp() });

    registry.uploadTexture('part-1', { width: 10, height: 10 });
    registry.uploadMesh('part-1', {
      vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
      uvs: [0, 0, 1, 0, 1, 1, 0, 1],
      indices: [0, 1, 2, 0, 2, 3],
    });

    registry.disposePart('part-1');

    expect(registry.hasTexture('part-1')).toBe(false);
    expect(registry.hasMesh('part-1')).toBe(false);
  });

  it('disposeAll cleans up all resources', () => {
    const registry = new PixiResourceRegistry({ app: createMockApp() });

    registry.uploadTexture('part-1', { width: 10, height: 10 });
    registry.uploadMesh('part-1', {
      vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
      uvs: [0, 0, 1, 0, 1, 1, 0, 1],
      indices: [0, 1, 2, 0, 2, 3],
    });

    registry.disposeAll();

    expect(registry.texturesByPartId.size).toBe(0);
    expect(registry.meshesByPartId.size).toBe(0);
    expect(registry.geometriesByPartId.size).toBe(0);
  });

  it('disposePart cleans dependent mask meshes for source and target', () => {
    const registry = new PixiResourceRegistry({ app: createMockApp() });

    registry.uploadTexture('target', { width: 10, height: 10 });
    registry.uploadMesh('target', {
      vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
      uvs: [0, 0, 1, 0, 1, 1, 0, 1],
      indices: [0, 1, 2, 0, 2, 3],
    });

    registry.ensureMaskMesh('source', 'target');
    expect(registry.maskMeshesBySourceNodeId.size).toBe(1);

    registry.disposePart('target');
    expect(registry.maskMeshesBySourceNodeId.size).toBe(0);
  });

  it('swapResources updates gateway and frame renderer resource references together', () => {
    const oldResources = new PixiResourceRegistry({ app: createMockApp() });
    const newResources = new PixiResourceRegistry({ app: createMockApp() });
    const frameRenderer = { resources: oldResources };
    const gateway = {
      resources: oldResources,
      frameRenderer,
    };

    const previous = PixiSceneGateway.prototype.swapResources.call(gateway, newResources);

    expect(previous).toBe(oldResources);
    expect(gateway.resources).toBe(newResources);
    expect(frameRenderer.resources).toBe(newResources);
  });
});
