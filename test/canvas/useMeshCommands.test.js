// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import React, { useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { useMeshCommands } from '@/features/canvas/application/useMeshCommands.js';

beforeEach(() => {
  if (typeof globalThis.ImageData === 'undefined') {
    globalThis.ImageData = class {
      constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4); }
    };
  }
});

// eslint-disable-next-line react/prop-types
function Harness({ meshWorkerClient, sceneGatewayRef, markDirty, updateProject: _updateProject, sendWorkflowEvent }) {
  const projectRef = useRef({ nodes: [], textures: [] });
  const updateProject = useRef(_updateProject);

  if (!updateProject.current) {
    updateProject.current = vi.fn((fn) => {
      fn(projectRef.current);
    });
  }

  const result = useMeshCommands({
    projectRef,
    updateProject: updateProject.current,
    meshWorkerClient,
    sceneGatewayRef,
    markDirty,
    sendWorkflowEvent,
  });

  Harness.refs = { projectRef, updateProject: updateProject.current, ...result };
  return null;
}

describe('useMeshCommands', () => {
  let container;
  let root;

  afterEach(() => {
    if (root) {
      act(() => root.unmount());
      root = null;
    }
    document.body.innerHTML = '';
  });

  function mount(fakes) {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(React.createElement(Harness, fakes));
    });
    return Harness.refs;
  }

  it('dispatchMeshWorker calls generate, uploadMesh, markDirty, updateProject', async () => {
    const fakeVertices = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }];
    const fakeUvs = new Float32Array([0, 0, 1, 0, 0, 1]);
    const fakeTriangles = new Uint16Array([0, 1, 2]);
    const fakeEdgeIndices = new Uint16Array([0, 1, 1, 2, 2, 0]);

    const generate = vi.fn(async () => ({
      vertices: fakeVertices,
      uvs: fakeUvs,
      triangles: fakeTriangles,
      edgeIndices: fakeEdgeIndices,
    }));

    const meshWorkerClient = { generate };

    const uploadMesh = vi.fn();
    const sceneGatewayRef = { current: { uploadMesh } };

    const markDirty = vi.fn();

    const refs = mount({ meshWorkerClient, sceneGatewayRef, markDirty });

    refs.projectRef.current = {
      nodes: [
        { id: 'p1', mesh: null, blendShapes: [], transform: { pivotX: 0, pivotY: 0 } },
      ],
      textures: [{ id: 'p1' }],
    };

    const imageData = new ImageData(100, 100);
    const opts = { detail: 'high' };

    await act(async () => {
      await refs.dispatchMeshWorker('p1', imageData, opts);
    });

    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenCalledWith('p1', imageData, opts);

    expect(uploadMesh).toHaveBeenCalledTimes(1);
    expect(uploadMesh).toHaveBeenCalledWith('p1', {
      vertices: fakeVertices,
      uvs: fakeUvs,
      triangles: fakeTriangles,
      edgeIndices: fakeEdgeIndices,
    });

    expect(markDirty).toHaveBeenCalledTimes(1);

    expect(refs.updateProject).toHaveBeenCalled();

    const node = refs.projectRef.current.nodes.find(n => n.id === 'p1');
    expect(node.mesh).toEqual({
      vertices: fakeVertices,
      uvs: Array.from(fakeUvs),
      triangles: fakeTriangles,
      edgeIndices: fakeEdgeIndices,
    });
  });

  it('binds a generated mesh to the assigned owner bone with full weight', async () => {
    const fakeVertices = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 0, y: 20 }];
    const generate = vi.fn(async () => ({
      vertices: fakeVertices,
      uvs: new Float32Array([0, 0, 1, 0, 0, 1]),
      triangles: [[0, 1, 2]],
      edgeIndices: [0, 1, 2],
    }));
    const refs = mount({
      meshWorkerClient: { generate },
      sceneGatewayRef: { current: { uploadMesh: vi.fn() } },
      markDirty: vi.fn(),
    });

    refs.projectRef.current = {
      nodes: [
        {
          id: 'p1',
          type: 'part',
          boneId: 'b1',
          mesh: null,
          blendShapes: [],
          transform: { pivotX: 0, pivotY: 0 },
        },
      ],
      bones: [{ id: 'b1', name: 'Bone 1', parentId: null, setup: {} }],
      textures: [{ id: 'p1' }],
    };

    await act(async () => {
      await refs.dispatchMeshWorker('p1', new ImageData(10, 10), {});
    });

    const mesh = refs.projectRef.current.nodes[0].mesh;
    expect(mesh.jointBoneId).toBe('b1');
    expect(mesh.boneWeights).toEqual([1, 1, 1]);
    expect(mesh.influences).toEqual([
      [{ boneId: 'b1', weight: 1 }],
      [{ boneId: 'b1', weight: 1 }],
      [{ boneId: 'b1', weight: 1 }],
    ]);
  });

  it('dispatchMeshWorker clears blendShapes when present', async () => {
    const generate = vi.fn(async () => ({
      vertices: [{ x: 0, y: 0 }],
      uvs: new Float32Array([0, 0]),
      triangles: new Uint16Array([0]),
      edgeIndices: new Uint16Array([0, 0]),
    }));

    const sceneGatewayRef = { current: { uploadMesh: vi.fn() } };
    const refs = mount({
      meshWorkerClient: { generate },
      sceneGatewayRef,
      markDirty: vi.fn(),
    });

    refs.projectRef.current = {
      nodes: [
        {
          id: 'p1', mesh: null,
          blendShapes: [{ name: 'blink' }],
          blendShapeValues: { blink: 1 },
          transform: { pivotX: 50, pivotY: 50 },
        },
      ],
      textures: [{ id: 'p1' }],
    };

    await act(async () => {
      await refs.dispatchMeshWorker('p1', new ImageData(10, 10), {});
    });

    const node = refs.projectRef.current.nodes.find(n => n.id === 'p1');
    expect(node.blendShapes).toEqual([]);
    expect(node.blendShapeValues).toEqual({});
  });

  it('dispatchMeshWorker does nothing when meshWorkerClient is null', async () => {
    const refs = mount({
      meshWorkerClient: null,
      sceneGatewayRef: { current: { uploadMesh: vi.fn() } },
      markDirty: vi.fn(),
    });

    const result = await refs.dispatchMeshWorker('p1', new ImageData(10, 10), {});
    expect(result).toBeUndefined();
  });

  it('deleteMeshForPart sets mesh to null', () => {
    const updateProject = vi.fn((fn) => {
      const p = { nodes: [{ id: 'p1', mesh: { vertices: [] } }] };
      fn(p);
    });

    const sceneGatewayRef = { current: { uploadMesh: vi.fn() } };
    const refs = mount({
      meshWorkerClient: null,
      sceneGatewayRef,
      markDirty: vi.fn(),
      updateProject,
    });

    refs.deleteMeshForPart('p1');
    expect(updateProject).toHaveBeenCalled();
  });

  it('remeshPart creates Image and calls dispatchMeshWorker when texture source exists', async () => {
    const generate = vi.fn(async () => ({
      vertices: [{ x: 0, y: 0 }],
      uvs: new Float32Array([0, 0]),
      triangles: new Uint16Array([0]),
      edgeIndices: new Uint16Array([0, 0]),
    }));
    const meshWorkerClient = { generate };
    const uploadMesh = vi.fn();
    const sceneGatewayRef = { current: { uploadMesh } };
    const markDirty = vi.fn();
    const updateProject = vi.fn((fn) => {
      fn({ nodes: [{ id: 'p1', mesh: null, blendShapes: [], transform: { pivotX: 0, pivotY: 0 } }] });
    });

    const origCanvasContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type) {
      if (type === '2d') return { drawImage: vi.fn(), getImageData: () => new ImageData(1, 1) };
      return null;
    };

    const origImage = globalThis.Image;
    globalThis.Image = class {
      constructor() { this.onload = null; }
      set src(_val) {
        this.width = 100; this.height = 100;
        setTimeout(() => { if (this.onload) this.onload(); }, 0);
      }
    };

    const refs = mount({ meshWorkerClient, sceneGatewayRef, markDirty, updateProject });

    refs.projectRef.current = {
      nodes: [{ id: 'p1', mesh: null }],
      textures: [{ id: 'p1', source: 'blob:test' }],
    };

    act(() => { refs.remeshPart('p1', {}); });

    await vi.waitFor(() => {
      expect(generate).toHaveBeenCalled();
    }, { timeout: 2000 });

    globalThis.Image = origImage;
    HTMLCanvasElement.prototype.getContext = origCanvasContext;
  });

  it('remeshPart resolves shared texture through node.textureId', async () => {
    const generate = vi.fn(async () => ({
      vertices: [{ x: 0, y: 0 }],
      uvs: new Float32Array([0, 0]),
      triangles: new Uint16Array([0]),
      edgeIndices: new Uint16Array([0, 0]),
    }));
    const origCanvasContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type) {
      if (type === '2d') return { drawImage: vi.fn(), getImageData: () => new ImageData(1, 1) };
      return null;
    };
    const origImage = globalThis.Image;
    globalThis.Image = class {
      constructor() { this.onload = null; }
      set src(_val) {
        this.width = 100; this.height = 100;
        setTimeout(() => { if (this.onload) this.onload(); }, 0);
      }
    };

    const refs = mount({
      meshWorkerClient: { generate },
      sceneGatewayRef: { current: { uploadMesh: vi.fn() } },
      markDirty: vi.fn(),
    });
    refs.projectRef.current = {
      nodes: [{ id: 'placed-p1', type: 'part', textureId: 'asset-p1', mesh: null }],
      textures: [{ id: 'asset-p1', source: 'blob:shared-texture' }],
    };

    act(() => { refs.remeshPart('placed-p1', {}); });

    await vi.waitFor(() => {
      expect(generate).toHaveBeenCalledWith('placed-p1', expect.any(ImageData), {});
    }, { timeout: 2000 });

    globalThis.Image = origImage;
    HTMLCanvasElement.prototype.getContext = origCanvasContext;
  });

  it('remeshPart returns undefined when node missing', () => {
    const refs = mount({
      meshWorkerClient: null,
      sceneGatewayRef: { current: { uploadMesh: vi.fn() } },
      markDirty: vi.fn(),
    });

    refs.projectRef.current = { nodes: [], textures: [] };

    const result = refs.remeshPart('missing', {});
    expect(result).toBeUndefined();
  });

  it('does not upload remeshed GPU data when project commit throws', async () => {
    const generate = vi.fn(async () => ({
      vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }],
      uvs: new Float32Array([0, 0, 1, 0, 0, 1]),
      triangles: new Uint16Array([0, 1, 2]),
      edgeIndices: new Uint16Array([0, 1, 1, 2, 2, 0]),
    }));
    const uploadMesh = vi.fn();
    const updateProject = vi.fn(() => {
      throw new Error('commit failed');
    });
    const refs = mount({
      meshWorkerClient: { generate },
      sceneGatewayRef: { current: { uploadMesh } },
      markDirty: vi.fn(),
      updateProject,
    });

    refs.projectRef.current = {
      nodes: [{ id: 'p1', mesh: null, blendShapes: [], transform: { pivotX: 0, pivotY: 0 } }],
      textures: [{ id: 'p1' }],
    };

    await expect(refs.dispatchMeshWorker('p1', new ImageData(10, 10), {})).rejects.toThrow('commit failed');
    expect(uploadMesh).not.toHaveBeenCalled();
  });

  it('uploads remeshed GPU data exactly once after project commit succeeds', async () => {
    const events = [];
    const mesh = {
      vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }],
      uvs: new Float32Array([0, 0, 1, 0, 0, 1]),
      triangles: new Uint16Array([0, 1, 2]),
      edgeIndices: new Uint16Array([0, 1, 1, 2, 2, 0]),
    };
    const generate = vi.fn(async () => mesh);
    const uploadMesh = vi.fn(() => events.push('uploadMesh'));
    const updateProject = vi.fn((fn) => {
      fn(refs.projectRef.current);
      events.push('commit');
    });
    const refs = mount({
      meshWorkerClient: { generate },
      sceneGatewayRef: { current: { uploadMesh } },
      markDirty: vi.fn(),
      updateProject,
    });

    refs.projectRef.current = {
      nodes: [{ id: 'p1', mesh: null, blendShapes: [], transform: { pivotX: 0, pivotY: 0 } }],
      textures: [{ id: 'p1' }],
    };

    await act(async () => {
      await refs.dispatchMeshWorker('p1', new ImageData(10, 10), {});
    });

    expect(uploadMesh).toHaveBeenCalledOnce();
    expect(events).toEqual(['commit', 'uploadMesh']);
  });

  describe('A12: remeshPart sends SET_TOOL meshAdjust after completion', () => {
    beforeEach(() => {
      HTMLCanvasElement.prototype.getContext = function (type) {
        if (type === '2d') return { drawImage: vi.fn(), getImageData: () => new ImageData(1, 1) };
        return null;
      };

      globalThis.Image = class {
        constructor() { this.onload = null; }
        set src(_val) {
          this.width = 100; this.height = 100;
          setTimeout(() => { if (this.onload) this.onload(); }, 0);
        }
      };
    });

    it('remeshPart sends SET_TOOL meshAdjust when switchTool=true (default)', async () => {
      const generate = vi.fn(async () => ({
        vertices: [{ x: 0, y: 0 }],
        uvs: new Float32Array([0, 0]),
        triangles: new Uint16Array([0]),
        edgeIndices: new Uint16Array([0, 0]),
      }));
      const meshWorkerClient = { generate };
      const uploadMesh = vi.fn();
      const sceneGatewayRef = { current: { uploadMesh } };
      const markDirty = vi.fn();
      const updateProject = vi.fn((fn) => {
        fn({ nodes: [{ id: 'p1', mesh: null, blendShapes: [], transform: { pivotX: 0, pivotY: 0 } }] });
      });
      const sendWorkflowEvent = vi.fn();

      const refs = mount({ meshWorkerClient, sceneGatewayRef, markDirty, updateProject, sendWorkflowEvent });

      refs.projectRef.current = {
        nodes: [{ id: 'p1', mesh: null }],
        textures: [{ id: 'p1', source: 'blob:test' }],
      };

      act(() => { refs.remeshPart('p1', {}); });

      await vi.waitFor(() => {
        expect(sendWorkflowEvent).toHaveBeenCalledWith({ type: 'SET_TOOL', tool: 'meshAdjust' });
      }, { timeout: 2000 });
    });

    it('remeshPart does not send SET_TOOL when switchTool=false', async () => {
      const generate = vi.fn(async () => ({
        vertices: [{ x: 0, y: 0 }],
        uvs: new Float32Array([0, 0]),
        triangles: new Uint16Array([0]),
        edgeIndices: new Uint16Array([0, 0]),
      }));
      const meshWorkerClient = { generate };
      const uploadMesh = vi.fn();
      const sceneGatewayRef = { current: { uploadMesh } };
      const markDirty = vi.fn();
      const updateProject = vi.fn((fn) => {
        fn({ nodes: [{ id: 'p1', mesh: null, blendShapes: [], transform: { pivotX: 0, pivotY: 0 } }] });
      });
      const sendWorkflowEvent = vi.fn();

      const refs = mount({ meshWorkerClient, sceneGatewayRef, markDirty, updateProject, sendWorkflowEvent });

      refs.projectRef.current = {
        nodes: [{ id: 'p1', mesh: null }],
        textures: [{ id: 'p1', source: 'blob:test' }],
      };

      act(() => { refs.remeshPart('p1', {}, false); });

      await vi.waitFor(() => {
        expect(generate).toHaveBeenCalled();
        expect(sendWorkflowEvent).not.toHaveBeenCalled();
      }, { timeout: 2000 });
    });
  });
});
