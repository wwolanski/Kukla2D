// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

if (typeof globalThis.ImageData === 'undefined') {
  globalThis.ImageData = class ImageData {
    constructor(dataOrLength, width, height) {
      if (dataOrLength instanceof Uint8ClampedArray) {
        this.data = dataOrLength;
        this.width = width;
        this.height = height;
      } else {
        this.data = new Uint8ClampedArray(dataOrLength * 4);
        this.width = width;
        this.height = height;
      }
    }
  };
}

function createMockViewport() {
  const listeners = new Map();
  return {
    __listeners: listeners,
    scale: { set: vi.fn(), x: 1 },
    position: { set: vi.fn(), x: 0, y: 0 },
    addChild: vi.fn(),
    on: vi.fn((event, fn) => { listeners.set(event, fn); }),
    off: vi.fn((event, fn) => {
      if (listeners.get(event) === fn) listeners.delete(event);
    }),
    destroy: vi.fn(),
    drag: vi.fn().mockReturnThis(),
    pinch: vi.fn().mockReturnThis(),
    wheel: vi.fn().mockReturnThis(),
    decelerate: vi.fn().mockReturnThis(),
    clampZoom: vi.fn().mockReturnThis(),
    resize: vi.fn(),
    toWorld: vi.fn((_x, _y) => ({ x: 0, y: 0 })),
    toScreen: vi.fn((_x, _y) => ({ x: 0, y: 0 })),
    toLocal: vi.fn((pt) => pt),
    toGlobal: vi.fn((pt) => pt),
  };
}

function createMockApp() {
  return {
    renderer: {
      width: 800,
      height: 600,
      events: {},
      resize: vi.fn(),
    },
    stage: {
      addChild: vi.fn(),
    },
    render: vi.fn(),
    init: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(),
  };
}

describe('pixiSceneGateway lifecycle', () => {
  let createPixiSceneGateway;
  let mockViewport;

  beforeEach(async () => {
    mockViewport = createMockViewport();

    vi.resetModules();
    vi.doMock('pixi.js', () => {
      const mockApp = createMockApp();
      return {
        Application: class {
          constructor() {
            Object.assign(this, mockApp);
          }
          async init(_opts) {
            this.initCalled = true;
          }
          render() {
            mockApp.render();
          }
          destroy(flag) {
            mockApp.destroy(flag);
          }
        },
        Container: class {
          constructor() {
            this.children = [];
          }
          addChild(child) {
            this.children.push(child);
          }
          destroy() {}
        },
        Graphics: class {
          constructor() { this.parent = null; }
          clear() {}
          stroke() {}
          fill() {}
          moveTo() {}
          lineTo() {}
          closePath() {}
          circle() {}
          destroy() {}
        },
      };
    });
    vi.doMock('pixi-viewport', () => ({
      Viewport: class {
        constructor() {
          Object.assign(this, mockViewport);
        }
      },
    }));

    const mod = await import(
      '@/features/canvas/infrastructure/rendering/pixi/createPixiSceneGateway.js'
    );
    createPixiSceneGateway = mod.createPixiSceneGateway;
  });

  afterEach(() => {
    vi.doUnmock('pixi.js');
    vi.doUnmock('pixi-viewport');
    vi.resetModules();
  });

  it('returns object with contract methods', async () => {
    const canvas = { parentElement: null, width: 800, height: 600 };
    const gateway = createPixiSceneGateway({
      canvas,
      onViewChange: vi.fn(),
      initialView: null,
    });

    await gateway.ready;

    expect(typeof gateway.draw).toBe('function');
    expect(typeof gateway.render).toBe('function');
    expect(typeof gateway.uploadTexture).toBe('function');
    expect(typeof gateway.uploadMesh).toBe('function');
    expect(typeof gateway.uploadQuadFallback).toBe('function');
    expect(typeof gateway.uploadPositions).toBe('function');
    expect(typeof gateway.hasTexture).toBe('function');
    expect(typeof gateway.hasMesh).toBe('function');
    expect(typeof gateway.capture).toBe('function');
    expect(typeof gateway.resize).toBe('function');
    expect(typeof gateway.dispose).toBe('function');
  });

  it('resize calls renderer resize and viewport resize', async () => {
    const canvas = { parentElement: null, width: 800, height: 600 };
    const app = createMockApp();

    vi.resetModules();
    vi.doMock('pixi.js', () => ({
      Application: class {
        constructor() {
          Object.assign(this, app);
        }
        async init() {}
        render() { app.render(); }
        destroy(...args) { app.destroy(...args); }
      },
      Container: class {
        constructor() { this.children = []; }
        addChild(c) { this.children.push(c); }
        destroy() {}
      },
      Graphics: class {
        constructor() { this.parent = null; }
        clear() {}
        stroke() {}
        fill() {}
        moveTo() {}
        lineTo() {}
        closePath() {}
        circle() {}
        destroy() {}
      },
    }));
    vi.doMock('pixi-viewport', () => ({
      Viewport: class {
        constructor() { Object.assign(this, mockViewport); }
      },
    }));

    const mod = await import(
      '@/features/canvas/infrastructure/rendering/pixi/createPixiSceneGateway.js'
    );
    const gw = mod.createPixiSceneGateway({
      canvas,
      onViewChange: vi.fn(),
      initialView: null,
    });
    await gw.ready;

    gw.resize(320, 240);

    expect(app.renderer.resize).toHaveBeenCalledWith(320, 240);
    expect(mockViewport.resize).toHaveBeenCalledWith(320, 240, 10000, 10000);
  });

  it('configures pixi viewport pan for middle/right mouse without inertia', async () => {
    const canvas = { parentElement: null, width: 800, height: 600 };
    const gw = createPixiSceneGateway({
      canvas,
      onViewChange: vi.fn(),
      initialView: null,
    });
    await gw.ready;

    expect(mockViewport.drag).toHaveBeenCalledWith({ mouseButtons: 'middle-right' });
    expect(mockViewport.decelerate).not.toHaveBeenCalled();
  });

  it('dispose calls app destroy', async () => {
    const canvas = { parentElement: null, width: 800, height: 600 };
    const app = createMockApp();

    vi.resetModules();
    vi.doMock('pixi.js', () => ({
      Application: class {
        constructor() { Object.assign(this, app); }
        async init() {}
        render() {}
        destroy(f) { app.destroy(f); }
      },
      Container: class {
        constructor() { this.children = []; }
        addChild(c) { this.children.push(c); }
        destroy() {}
      },
      Graphics: class {
        constructor() { this.parent = null; }
        clear() {}
        stroke() {}
        fill() {}
        moveTo() {}
        lineTo() {}
        closePath() {}
        circle() {}
        destroy() {}
      },
    }));
    vi.doMock('pixi-viewport', () => ({
      Viewport: class {
        constructor() { Object.assign(this, createMockViewport()); }
      },
    }));

    const mod = await import(
      '@/features/canvas/infrastructure/rendering/pixi/createPixiSceneGateway.js'
    );
    const gw = mod.createPixiSceneGateway({
      canvas,
      onViewChange: vi.fn(),
      initialView: null,
    });
    await gw.ready;

    gw.dispose();

    expect(app.destroy).toHaveBeenCalledWith(
      { removeView: false },
      { children: true },
    );
  });

  it('hasTexture/hasMesh return false before upload', async () => {
    const canvas = { parentElement: null, width: 800, height: 600 };

    vi.resetModules();
    vi.doMock('pixi.js', () => ({
      Application: class {
        constructor() {
          this.renderer = { width: 800, height: 600, events: {}, resize: vi.fn() };
          this.stage = { addChild: vi.fn() };
          this.render = vi.fn();
          this.destroy = vi.fn();
        }
        async init() {}
        render() {}
        destroy() {}
      },
      Container: class {
        constructor() { this.children = []; }
        addChild(c) { this.children.push(c); }
        destroy() {}
      },
      Graphics: class {
        constructor() { this.parent = null; }
        clear() {}
        stroke() {}
        fill() {}
        moveTo() {}
        lineTo() {}
        closePath() {}
        circle() {}
        destroy() {}
      },
    }));
    vi.doMock('pixi-viewport', () => ({
      Viewport: class {
        constructor() { Object.assign(this, createMockViewport()); }
      },
    }));

    const mod = await import(
      '@/features/canvas/infrastructure/rendering/pixi/createPixiSceneGateway.js'
    );
    const gw = mod.createPixiSceneGateway({
      canvas,
      onViewChange: vi.fn(),
      initialView: null,
    });
    await gw.ready;

    expect(gw.hasTexture('part-1')).toBe(false);
    expect(gw.hasMesh('part-1')).toBe(false);
  });

  it('drawFrame applies transforms from effectiveNodes', async () => {
    const canvas = { parentElement: null, width: 800, height: 600 };
    const gw = createPixiSceneGateway({
      canvas,
      onViewChange: vi.fn(),
      initialView: null,
    });
    await gw.ready;

    const mesh = {
      parent: null,
      position: { x: 0, y: 0 },
      rotation: 0,
      scale: { x: 1, y: 1 },
      pivot: { x: 0, y: 0 },
      destroy: vi.fn(),
    };
    gw.resources.meshesByPartId.set('part-1', mesh);

    gw.drawFrame({
      project: {
        nodes: [{
          id: 'part-1',
          type: 'part',
          visible: true,
          opacity: 1,
          draw_order: 0,
          transform: { x: 10, y: 20 },
        }],
      },
      effectiveNodes: [{
        id: 'part-1',
        type: 'part',
        visible: true,
        opacity: 1,
        draw_order: 0,
        transform: { x: 99, y: 88, rotation: 45, scaleX: 2, scaleY: 3, pivotX: 4, pivotY: 5 },
      }],
      view: { zoom: 1, panX: 0, panY: 0 },
    });

    expect(mesh.position).toEqual({ x: 103, y: 93 });
    expect(mesh.rotation).toBeCloseTo(Math.PI / 4);
    expect(mesh.scale).toEqual({ x: 2, y: 3 });
    expect(mesh.pivot).toEqual({ x: 4, y: 5 });
  });

  it('can defer drawFrame render until overlay is updated', async () => {
    const canvas = { parentElement: null, width: 800, height: 600 };
    const gw = createPixiSceneGateway({
      canvas,
      onViewChange: vi.fn(),
      initialView: null,
    });
    await gw.ready;

    const renderSpy = vi.spyOn(gw, 'render');

    gw.drawFrame({
      project: { nodes: [] },
      effectiveNodes: [],
      view: { zoom: 1, panX: 0, panY: 0 },
    }, { skipRender: true });

    expect(renderSpy).not.toHaveBeenCalled();

    gw.render();
    expect(renderSpy).toHaveBeenCalledTimes(1);
  });

  it('marks scene dirty when pixi viewport moves', async () => {
    const canvas = { parentElement: null, width: 800, height: 600 };
    const onViewChange = vi.fn();
    const markDirty = vi.fn();
    const gw = createPixiSceneGateway({
      canvas,
      onViewChange,
      initialView: null,
    });
    await gw.ready;

    gw.createInteractionSystem({
      projectRef: { current: { nodes: [] } },
      editorRef: { current: { selection: [], view: { zoom: 1 } } },
      animationRef: { current: {} },
      updateProject: vi.fn(),
      setSelection: vi.fn(),
      markDirty,
      workflowActor: { send: vi.fn() },
      executeCommand: vi.fn(),
    });

    mockViewport.__listeners.get('moved')();

    expect(onViewChange).toHaveBeenCalledWith({ zoom: 1, panX: 0, panY: 0 });
    expect(markDirty).toHaveBeenCalled();
  });

  it('capture returns null when app has no gl', async () => {
    const canvas = { parentElement: null, width: 800, height: 600 };

    vi.resetModules();
    vi.doMock('pixi.js', () => ({
      Application: class {
        constructor() {
          this.renderer = { width: 800, height: 600, events: {}, resize: vi.fn(), gl: null };
          this.stage = { addChild: vi.fn() };
          this.render = vi.fn();
          this.destroy = vi.fn();
        }
        async init() {}
        render() {}
        destroy() {}
      },
      Container: class {
        constructor() { this.children = []; }
        addChild(c) { this.children.push(c); }
        destroy() {}
      },
      Graphics: class {
        constructor() { this.parent = null; }
        clear() {}
        stroke() {}
        fill() {}
        moveTo() {}
        lineTo() {}
        closePath() {}
        circle() {}
        destroy() {}
      },
    }));
    vi.doMock('pixi-viewport', () => ({
      Viewport: class {
        constructor() { Object.assign(this, createMockViewport()); }
      },
    }));

    const mod = await import(
      '@/features/canvas/infrastructure/rendering/pixi/createPixiSceneGateway.js'
    );
    const gw = mod.createPixiSceneGateway({
      canvas,
      onViewChange: vi.fn(),
      initialView: null,
    });
    await gw.ready;

    const result = gw.capture({ width: 100, height: 100 });
    expect(result).toBeNull();
  });

  it('capture with gl returns ImageData and restores renderer size', async () => {
    const canvas = { parentElement: null, width: 800, height: 600 };

    const mockGl = {
      readPixels: vi.fn((_x, _y, w, h, _fmt, _type, buf) => {
        for (let i = 0; i < buf.length; i += 4) {
          buf[i] = 128; buf[i + 1] = 64; buf[i + 2] = 32; buf[i + 3] = 255;
        }
      }),
      RGBA: 0x1908,
      UNSIGNED_BYTE: 0x1401,
    };

    vi.resetModules();
    vi.doMock('pixi.js', () => ({
      Application: class {
        constructor() {
          this.renderer = { width: 800, height: 600, events: {}, resize: vi.fn(), gl: mockGl };
          this.stage = { addChild: vi.fn() };
          this.render = vi.fn();
          this.destroy = vi.fn();
        }
        async init() {}
        render() {}
        destroy() {}
      },
      Container: class {
        constructor() { this.children = []; }
        addChild(c) { this.children.push(c); }
        destroy() {}
      },
      Graphics: class {
        constructor() { this.parent = null; }
        clear() {}
        stroke() {}
        fill() {}
        moveTo() {}
        lineTo() {}
        closePath() {}
        circle() {}
        destroy() {}
      },
    }));
    vi.doMock('pixi-viewport', () => ({
      Viewport: class {
        constructor() {
          const vpMock = createMockViewport();
          Object.assign(this, vpMock);
        }
      },
    }));

    const mod = await import(
      '@/features/canvas/infrastructure/rendering/pixi/createPixiSceneGateway.js'
    );
    const gw = mod.createPixiSceneGateway({
      canvas,
      onViewChange: vi.fn(),
      initialView: null,
    });
    await gw.ready;

    const result = gw.capture({ width: 200, height: 150 });
    expect(result).not.toBeNull();
    expect(result.width).toBe(200);
    expect(result.height).toBe(150);
    expect(result.data).toBeInstanceOf(Uint8ClampedArray);
    expect(result.data.length).toBe(200 * 150 * 4);

    expect(mockGl.readPixels).toHaveBeenCalled();
    expect(gw.app.renderer.resize).toHaveBeenCalledWith(800, 600);
  });
});
