// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function createContentLayer() {
  return {
    children: [],
    sortableChildren: false,
    addChild(child) {
      if (!this.children.includes(child)) this.children.push(child);
      child.parent = this;
      return child;
    },
    removeChild(child) {
      this.children = this.children.filter((item) => item !== child);
      if (child.parent === this) child.parent = null;
      return child;
    },
  };
}

function makePart(id, extra = {}) {
  return {
    id,
    type: 'part',
    name: id,
    visible: true,
    opacity: 1,
    draw_order: 0,
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
    ...extra,
  };
}

describe('PixiFrameRenderer clipping', () => {
  let PixiFrameRenderer;
  let PixiResourceRegistry;

  beforeEach(async () => {
    vi.resetModules();
    vi.doMock('pixi.js', () => {
      let textureCounter = 0;

      class MockMesh {
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
          this.renderable = true;
          this.includeInBuild = false;
          this.measurable = true;
          this.destroy = vi.fn(() => {
            this.destroyed = true;
          });
          this.setMask = vi.fn(({ mask, channel }) => {
            this.mask = mask;
            this._maskChannel = channel;
          });
        }
      }

      return {
        Texture: {
          WHITE: { destroy: vi.fn() },
          from: vi.fn(() => ({
            destroy: vi.fn(),
            _id: ++textureCounter,
          })),
        },
        MeshGeometry: class {
          constructor(opts) {
            this._attrs = {};
            if (opts.positions) this._attrs.positions = { data: opts.positions, update: vi.fn() };
            if (opts.uvs) this._attrs.uvs = { data: opts.uvs, update: vi.fn() };
            if (opts.indices) this._attrs.indices = { data: opts.indices };
          }
          getAttribute(name) { return this._attrs[name] || null; }
          getIndex() { return this._attrs.indices || null; }
          destroy() {}
        },
        Mesh: MockMesh,
      };
    });

    ({ PixiFrameRenderer } = await import('@/features/canvas/infrastructure/rendering/pixi/PixiFrameRenderer.js'));
    ({ PixiResourceRegistry } = await import('@/features/canvas/infrastructure/rendering/pixi/PixiResourceRegistry.js'));
  });

  afterEach(() => {
    vi.doUnmock('pixi.js');
    vi.resetModules();
  });

  function createRendererHarness() {
    const resources = new PixiResourceRegistry({ app: { renderer: { width: 800, height: 600 } } });
    const contentLayer = createContentLayer();
    const viewportBridge = {
      readEditorView: () => ({ zoom: 1, panX: 0, panY: 0 }),
      applyEditorView: vi.fn(),
    };
    const renderer = new PixiFrameRenderer({ resources, contentLayer, viewportBridge });

    return { resources, contentLayer, renderer };
  }

  function uploadQuad(resources, partId) {
    resources.uploadTexture(partId, { width: 32, height: 32 });
    resources.uploadMesh(partId, {
      vertices: [{ x: 0, y: 0 }, { x: 32, y: 0 }, { x: 32, y: 32 }, { x: 0, y: 32 }],
      uvs: [0, 0, 1, 0, 1, 1, 0, 1],
      indices: [0, 1, 2, 0, 2, 3],
    });
  }

  it('applies alpha-channel mask clone from clip target and keeps target mesh visible', () => {
    const { resources, renderer } = createRendererHarness();
    uploadQuad(resources, 'mask');
    uploadQuad(resources, 'iris');

    renderer.drawFrame({
      project: { nodes: [] },
      effectiveNodes: [
        makePart('mask', {
          name: 'eyewhite',
          draw_order: 1,
          transform: { x: 10, y: 20, rotation: 45, scaleX: 2, scaleY: 3, pivotX: 4, pivotY: 5 },
        }),
        makePart('iris', {
          name: 'irides',
          draw_order: 2,
          clipToPartId: 'mask',
        }),
      ],
      view: { zoom: 1, panX: 0, panY: 0 },
    });

    const targetMesh = resources.meshesByPartId.get('mask');
    const sourceMesh = resources.meshesByPartId.get('iris');
    const maskMesh = resources.maskMeshesBySourceNodeId.get('iris');

    expect(sourceMesh.mask).toBe(maskMesh);
    expect(sourceMesh._maskChannel).toBe('alpha');
    expect(maskMesh).not.toBe(targetMesh);
    expect(maskMesh.geometry).toBe(targetMesh.geometry);
    expect(maskMesh.texture).toBe(targetMesh.texture);
    expect(maskMesh.position).toEqual({ x: 14, y: 25 });
    expect(maskMesh.rotation).toBeCloseTo(Math.PI / 4);
    expect(maskMesh.scale).toEqual({ x: 2, y: 3 });
    expect(targetMesh.parent).toBeTruthy();
  });

  it('supports many source nodes clipping to one target with distinct mask objects', () => {
    const { resources, renderer } = createRendererHarness();
    uploadQuad(resources, 'mask');
    uploadQuad(resources, 'iris-a');
    uploadQuad(resources, 'iris-b');

    renderer.drawFrame({
      project: { nodes: [] },
      effectiveNodes: [
        makePart('mask'),
        makePart('iris-a', { clipToPartId: 'mask' }),
        makePart('iris-b', { clipToPartId: 'mask' }),
      ],
      view: { zoom: 1, panX: 0, panY: 0 },
    });

    const maskA = resources.maskMeshesBySourceNodeId.get('iris-a');
    const maskB = resources.maskMeshesBySourceNodeId.get('iris-b');
    const targetMesh = resources.meshesByPartId.get('mask');

    expect(maskA).not.toBe(maskB);
    expect(maskA.geometry).toBe(targetMesh.geometry);
    expect(maskB.geometry).toBe(targetMesh.geometry);
    expect(maskA.texture).toBe(targetMesh.texture);
    expect(maskB.texture).toBe(targetMesh.texture);
  });

  it('updates and clears masks when relation changes or disappears', () => {
    const { resources, renderer } = createRendererHarness();
    uploadQuad(resources, 'mask-a');
    uploadQuad(resources, 'mask-b');
    uploadQuad(resources, 'iris');

    renderer.drawFrame({
      project: { nodes: [] },
      effectiveNodes: [
        makePart('mask-a', { transform: { x: 1, y: 2, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 } }),
        makePart('mask-b', { transform: { x: 5, y: 6, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 } }),
        makePart('iris', { clipToPartId: 'mask-a' }),
      ],
      view: { zoom: 1, panX: 0, panY: 0 },
    });

    const firstMask = resources.maskMeshesBySourceNodeId.get('iris');

    renderer.drawFrame({
      project: { nodes: [] },
      effectiveNodes: [
        makePart('mask-a'),
        makePart('mask-b'),
        makePart('iris', { clipToPartId: 'mask-b' }),
      ],
      view: { zoom: 1, panX: 0, panY: 0 },
    });

    const secondMask = resources.maskMeshesBySourceNodeId.get('iris');
    expect(firstMask.destroy).toHaveBeenCalled();
    expect(secondMask).not.toBe(firstMask);

    renderer.drawFrame({
      project: { nodes: [] },
      effectiveNodes: [
        makePart('mask-a'),
        makePart('mask-b'),
        makePart('iris'),
      ],
      view: { zoom: 1, panX: 0, panY: 0 },
    });

    expect(resources.maskMeshesBySourceNodeId.has('iris')).toBe(false);
    expect(resources.meshesByPartId.get('iris').mask).toBeNull();
    expect(secondMask.destroy).toHaveBeenCalled();
  });

  it('syncs target visibility and skips invalid direct relations without crashing', () => {
    const { resources, renderer } = createRendererHarness();
    uploadQuad(resources, 'mask');
    uploadQuad(resources, 'iris');

    expect(() => renderer.drawFrame({
      project: { nodes: [] },
      effectiveNodes: [
        makePart('mask', { visible: false }),
        makePart('iris', { clipToPartId: 'mask' }),
      ],
      view: { zoom: 1, panX: 0, panY: 0 },
    })).not.toThrow();

    const maskMesh = resources.maskMeshesBySourceNodeId.get('iris');
    expect(maskMesh.visible).toBe(false);

    expect(() => renderer.drawFrame({
      project: { nodes: [] },
      effectiveNodes: [
        makePart('iris', { clipToPartId: 'missing-target' }),
      ],
      view: { zoom: 1, panX: 0, panY: 0 },
    })).not.toThrow();

    expect(resources.meshesByPartId.get('iris').mask).toBeNull();
    expect(resources.maskMeshesBySourceNodeId.has('iris')).toBe(false);

    expect(() => renderer.drawFrame({
      project: { nodes: [] },
      effectiveNodes: [
        makePart('iris', { clipToPartId: 'iris' }),
      ],
      view: { zoom: 1, panX: 0, panY: 0 },
    })).not.toThrow();

    expect(resources.meshesByPartId.get('iris').mask).toBeNull();
    expect(resources.maskMeshesBySourceNodeId.has('iris')).toBe(false);
  });

  it('clears mask when source becomes invisible', () => {
    const { resources, renderer } = createRendererHarness();
    uploadQuad(resources, 'mask');
    uploadQuad(resources, 'iris');

    renderer.drawFrame({
      project: { nodes: [] },
      effectiveNodes: [
        makePart('mask'),
        makePart('iris', { clipToPartId: 'mask' }),
      ],
      view: { zoom: 1, panX: 0, panY: 0 },
    });

    const maskMesh = resources.maskMeshesBySourceNodeId.get('iris');

    renderer.drawFrame({
      project: { nodes: [] },
      effectiveNodes: [
        makePart('mask'),
        makePart('iris', { clipToPartId: 'mask', visible: false }),
      ],
      view: { zoom: 1, panX: 0, panY: 0 },
    });

    expect(resources.meshesByPartId.get('iris').mask).toBeNull();
    expect(resources.maskMeshesBySourceNodeId.has('iris')).toBe(false);
    expect(maskMesh.destroy).toHaveBeenCalled();
  });

  it('keeps project without clipping unchanged and disposes masks on renderer dispose', () => {
    const { resources, contentLayer, renderer } = createRendererHarness();
    uploadQuad(resources, 'mask');
    uploadQuad(resources, 'plain');
    uploadQuad(resources, 'iris');

    renderer.drawFrame({
      project: { nodes: [] },
      effectiveNodes: [
        makePart('mask'),
        makePart('plain', { opacity: 0.4, draw_order: 7 }),
        makePart('iris', { clipToPartId: 'mask' }),
      ],
      view: { zoom: 1, panX: 0, panY: 0 },
    });

    const plainMesh = resources.meshesByPartId.get('plain');
    const irisMask = resources.maskMeshesBySourceNodeId.get('iris');

    expect(plainMesh.parent).toBe(contentLayer);
    expect(plainMesh.alpha).toBe(0.4);
    expect(plainMesh.zIndex).toBe(7);
    expect(plainMesh.mask).toBeNull();

    renderer.dispose();
    expect(irisMask.destroy).toHaveBeenCalled();
    expect(resources.maskMeshesBySourceNodeId.size).toBe(0);
  });
});
