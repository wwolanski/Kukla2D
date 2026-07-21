import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const graphicsInstances = [];

function createMockGraphics() {
  const listeners = new Map();
  const g = {
    position: { set: vi.fn() },
    fill: vi.fn(() => g),
    circle: vi.fn(() => g),
    poly: vi.fn(() => g),
    on: vi.fn((event, fn) => {
      listeners.set(event, fn);
      return g;
    }),
    off: vi.fn((event, fn) => {
      if (listeners.get(event) === fn) listeners.delete(event);
      return g;
    }),
    destroy: vi.fn(),
    parent: null,
    eventMode: 'passive',
    cursor: null,
    __listeners: listeners,
  };
  graphicsInstances.push(g);
  return g;
}

describe('PixiInteractionSystem', () => {
  let PixiInteractionSystem;

  beforeEach(async () => {
    graphicsInstances.length = 0;
    vi.doMock('pixi.js', () => ({
      Graphics: vi.fn(function Graphics() {
        return createMockGraphics();
      }),
    }));
    const mod = await import('@/features/canvas/infrastructure/rendering/pixi/PixiInteractionSystem.js');
    PixiInteractionSystem = mod.PixiInteractionSystem;
  });

  afterEach(() => {
    vi.doUnmock('pixi.js');
    vi.resetModules();
  });

  it('moves selected node on Pixi gizmo drag and marks scene dirty', () => {
    const project = {
      nodes: [{
        id: 'part-1',
        type: 'part',
        transform: { x: 10, y: 20, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
      }],
    };
    const editor = {
      selection: ['part-1'],
      editorMode: 'staging',
      view: { zoom: 2, panX: 0, panY: 0 },
    };
    const markDirty = vi.fn();
    const updateProject = vi.fn((recipe) => recipe(project, { transformVersion: 0 }));
    const viewportDrag = { pause: vi.fn(), resume: vi.fn() };

    const adapter = new PixiInteractionSystem({
      viewportBridge: {
        app: { canvas: { getBoundingClientRect: () => ({ left: 0, top: 0 }) } },
        viewport: { plugins: viewportDrag },
      },
      overlayLayer: {
        addChild: vi.fn((child) => { child.parent = adapter.overlayLayer; }),
        removeChild: vi.fn((child) => { child.parent = null; }),
      },
      projectRef: { current: project },
      editorRef: { current: editor },
      animationRef: { current: { setDraftPose: vi.fn() } },
      updateProject,
      setSelection: vi.fn(),
      markDirty,
      workflowActor: { send: vi.fn() },
      executeCommand: (cmd) => { if (cmd.type === 'updateProject') updateProject(cmd.payload.mutator); },
    });

    const sendWorkflow = vi.spyOn(adapter, '_sendWorkflow');

    adapter._startMoveDrag({ clientX: 100, clientY: 100 });
    adapter._onDragMove({ clientX: 120, clientY: 110 });

    expect(project.nodes[0].transform.x).toBe(10);
    expect(project.nodes[0].transform.y).toBe(20);
    expect(adapter.readPreviewPoseOverrides().get('part-1')).toEqual({ x: 20, y: 25 });
    expect(markDirty).toHaveBeenCalled();
    expect(updateProject).not.toHaveBeenCalled();
    expect(viewportDrag.pause).toHaveBeenCalledWith('drag');

    adapter._onDragEnd();

    expect(sendWorkflow).toHaveBeenCalledWith({
      type: 'START_TRANSFORM_DRAG',
      payload: { mode: 'move', nodeId: 'part-1' },
    });
    expect(sendWorkflow).toHaveBeenCalledWith({
      type: 'MOVE_GESTURE',
      payload: { mode: 'move', clientX: 120, clientY: 110 },
    });
    expect(sendWorkflow).toHaveBeenCalledWith({ type: 'COMMIT_GESTURE' });
    expect(project.nodes[0].transform.x).toBe(20);
    expect(project.nodes[0].transform.y).toBe(25);
    expect(updateProject).toHaveBeenCalledTimes(1);
    expect(adapter.readPreviewPoseOverrides()).toBeNull();
    expect(viewportDrag.resume).toHaveBeenCalledWith('drag');
  });

  it('rotates selected node without missing adapter world-position helper', () => {
    const project = {
      nodes: [{
        id: 'part-1',
        type: 'part',
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
      }],
    };
    const editor = {
      selection: ['part-1'],
      editorMode: 'staging',
      view: { zoom: 1, panX: 0, panY: 0 },
    };
    const adapter = new PixiInteractionSystem({
      viewportBridge: {
        app: { canvas: { getBoundingClientRect: () => ({ left: 0, top: 0 }) } },
        viewport: { plugins: { pause: vi.fn(), resume: vi.fn() } },
        toWorld: (x, y) => ({ x, y }),
      },
      overlayLayer: {
        addChild: vi.fn((child) => { child.parent = adapter.overlayLayer; }),
        removeChild: vi.fn((child) => { child.parent = null; }),
      },
      projectRef: { current: project },
      editorRef: { current: editor },
      animationRef: { current: { setDraftPose: vi.fn() } },
      updateProject: vi.fn((recipe) => recipe(project, { transformVersion: 0 })),
      setSelection: vi.fn(),
      markDirty: vi.fn(),
      workflowActor: { send: vi.fn() },
      executeCommand: vi.fn(),
    });
    const sendWorkflow = vi.spyOn(adapter, '_sendWorkflow');

    adapter._startRotateDrag();
    expect(() => adapter._onDragMove({ clientX: 0, clientY: 1 })).not.toThrow();
    expect(() => adapter._onDragMove({ clientX: 1, clientY: 0 })).not.toThrow();

    expect(adapter.readPreviewPoseOverrides().get('part-1')).toHaveProperty('rotation');
    expect(sendWorkflow).toHaveBeenCalledWith({
      type: 'START_TRANSFORM_DRAG',
      payload: { mode: 'rotate', nodeId: 'part-1' },
    });
  });

  it('removes Pixi handle listeners before replacing handles', () => {
    const adapter = new PixiInteractionSystem({
      viewportBridge: {},
      overlayLayer: {
        addChild: vi.fn((child) => { child.parent = adapter.overlayLayer; }),
        removeChild: vi.fn((child) => { child.parent = null; }),
      },
      projectRef: { current: { nodes: [] } },
      editorRef: { current: { selection: [], view: { zoom: 1 } } },
      animationRef: { current: {} },
      updateProject: vi.fn(),
      setSelection: vi.fn(),
      markDirty: vi.fn(),
      workflowActor: { send: vi.fn() },
      executeCommand: vi.fn(),
    });

    adapter.updateHandles({
      gizmoFrame: {
        visible: true,
        center: { x: 0, y: 0 },
        pivot: { x: 10, y: 10 },
        rotationHandle: { x: 20, y: 20 },
      },
      zoom: 1,
    });
    const firstHandle = graphicsInstances[0];

    adapter.updateHandles({ gizmoFrame: null, zoom: 1 });

    expect(firstHandle.off).toHaveBeenCalledWith('pointerdown', expect.any(Function));
    expect(firstHandle.destroy).toHaveBeenCalled();
  });

  it('does not rebuild hit handles while dragging', () => {
    const adapter = new PixiInteractionSystem({
      viewportBridge: {},
      overlayLayer: {
        addChild: vi.fn((child) => { child.parent = adapter.overlayLayer; }),
        removeChild: vi.fn((child) => { child.parent = null; }),
      },
      projectRef: { current: { nodes: [] } },
      editorRef: { current: { selection: [], view: { zoom: 1 } } },
      animationRef: { current: {} },
      updateProject: vi.fn(),
      setSelection: vi.fn(),
      markDirty: vi.fn(),
      workflowActor: { send: vi.fn() },
      executeCommand: vi.fn(),
    });

    adapter.updateHandles({
      gizmoFrame: {
        visible: true,
        center: { x: 0, y: 0 },
        pivot: { x: 10, y: 10 },
        rotationHandle: { x: 20, y: 20 },
      },
      zoom: 1,
    });
    const firstHandle = graphicsInstances[0];
    adapter._dragState = { type: 'move' };

    adapter.updateHandles({
      gizmoFrame: {
        visible: true,
        center: { x: 100, y: 100 },
        pivot: { x: 110, y: 110 },
        rotationHandle: { x: 120, y: 120 },
      },
      zoom: 1,
    });

    expect(firstHandle.destroy).not.toHaveBeenCalled();
    expect(graphicsInstances).toHaveLength(3);
  });

  it('creates bone body, rotate ring and length handles for selected bone', () => {
    const project = {
      nodes: [],
      bones: [
        { id: 'b1', nodeId: 'arm', setup: { x: 0, y: 0, rotation: 0, length: 100 } },
      ],
    };
    const adapter = new PixiInteractionSystem({
      viewportBridge: {
        app: { canvas: { getBoundingClientRect: () => ({ left: 0, top: 0 }) } },
        viewport: { plugins: { pause: vi.fn(), resume: vi.fn() } },
        toWorld: (x, y) => ({ x, y }),
      },
      overlayLayer: {
        addChild: vi.fn((child) => { child.parent = adapter.overlayLayer; }),
        removeChild: vi.fn((child) => { child.parent = null; }),
      },
      projectRef: { current: project },
      editorRef: {
        current: {
          selection: ['b1'],
          activeBoneId: 'b1',
          activeTool: 'transform',
          selectionTarget: 'rig',
          skeletonEditMode: false,
          view: { zoom: 1 },
        },
      },
      animationRef: { current: { setDraftPose: vi.fn() } },
      updateProject: vi.fn((recipe) => recipe(project)),
      setSelection: vi.fn(),
      markDirty: vi.fn(),
      workflowActor: { send: vi.fn() },
      executeCommand: vi.fn(),
    });

    const skeletonFrame = {
      joints: [{ x: 0, y: 0, boneId: 'b1' }],
      boneLines: [],
      boneTransformFrame: {
        boneId: 'b1',
        start: { x: 0, y: 0 },
        end: { x: 100, y: 0 },
        rotateHandle: { x: 0, y: 56 },
        lengthHandle: { x: 100, y: 0 },
        rotateRingRadius: 24,
        lengthHandleRadius: 7,
      },
    };

    adapter.updateHandles({ gizmoFrame: null, warpFrame: null, skeletonFrame, zoom: 1 });

    expect(adapter._boneBodyHandle).not.toBeNull();
    expect(adapter._boneRotateHandle).not.toBeNull();
    expect(adapter._boneLengthHandle).not.toBeNull();

    const transformHandles = [
      adapter._boneBodyHandle,
      adapter._boneRotateHandle,
      adapter._boneLengthHandle,
    ];
    adapter.updateHandles({ gizmoFrame: null, warpFrame: null, skeletonFrame: null, zoom: 1 });
    for (const handle of transformHandles) {
      expect(handle.destroy).toHaveBeenCalledTimes(1);
    }
  });

  it('starts bone move from the Pixi body handle with the selected bone id', () => {
    const project = {
      nodes: [],
      bones: [
        { id: 'b1', nodeId: 'arm', setup: { x: 0, y: 0, rotation: 0, length: 100 } },
      ],
    };
    const adapter = new PixiInteractionSystem({
      viewportBridge: {
        app: { canvas: { getBoundingClientRect: () => ({ left: 0, top: 0 }) } },
        viewport: { plugins: { pause: vi.fn(), resume: vi.fn() } },
        toWorld: (x, y) => ({ x, y }),
      },
      overlayLayer: {
        addChild: vi.fn((child) => { child.parent = adapter.overlayLayer; }),
        removeChild: vi.fn((child) => { child.parent = null; }),
      },
      projectRef: { current: project },
      editorRef: {
        current: {
          selection: ['b1'],
          activeBoneId: 'b1',
          activeTool: 'transform',
          selectionTarget: 'rig',
          skeletonEditMode: false,
          editorMode: 'staging',
          view: { zoom: 1 },
        },
      },
      animationRef: { current: { setDraftPose: vi.fn() } },
      updateProject: vi.fn((recipe) => recipe(project)),
      setSelection: vi.fn(),
      markDirty: vi.fn(),
      workflowActor: { send: vi.fn() },
      executeCommand: vi.fn(),
    });

    adapter.updateHandles({
      gizmoFrame: null,
      warpFrame: null,
      skeletonFrame: {
        joints: [{ x: 0, y: 0, boneId: 'b1' }],
        boneLines: [],
        boneTransformFrame: {
          boneId: 'b1',
          start: { x: 0, y: 0 },
          end: { x: 100, y: 0 },
          rotateHandle: { x: 0, y: 56 },
          lengthHandle: { x: 100, y: 0 },
          rotateRingRadius: 24,
          lengthHandleRadius: 7,
        },
      },
      zoom: 1,
    });

    const down = adapter._boneBodyHandle.__listeners.get('pointerdown');
    down({ stopPropagation: vi.fn(), clientX: 10, clientY: 20 });

    expect(adapter._dragState.type).toBe('boneMove');
    expect(adapter._dragState.boneId).toBe('b1');
  });

  it('moves selected bone on Pixi boneMove drag and respects link ON for assigned nodes', () => {
    const project = {
      nodes: [
        { id: 'arm', type: 'group', transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 } },
        { id: 'part-1', type: 'part', boneId: 'b1', transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 } },
        { id: 'part-2', type: 'part', boneId: 'b1', transform: { x: 50, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, boneLinkLocked: false },
      ],
      bones: [
        { id: 'b1', nodeId: 'arm', setup: { x: 0, y: 0, rotation: 0, length: 100 } },
      ],
    };
    const editor = {
      selection: ['b1'],
      activeBoneId: 'b1',
      skeletonEditMode: false,
      editorMode: 'staging',
      view: { zoom: 2, panX: 0, panY: 0 },
    };
    const markDirty = vi.fn();
    const updateProject = vi.fn((recipe) => recipe(project));
    const adapter = new PixiInteractionSystem({
      viewportBridge: {
        app: { canvas: { getBoundingClientRect: () => ({ left: 0, top: 0 }) } },
        viewport: { plugins: { pause: vi.fn(), resume: vi.fn() } },
        toWorld: (x, y) => ({ x: x / 2, y: y / 2 }),
      },
      overlayLayer: {
        addChild: vi.fn((child) => { child.parent = adapter.overlayLayer; }),
        removeChild: vi.fn((child) => { child.parent = null; }),
      },
      projectRef: { current: project },
      editorRef: { current: editor },
      animationRef: { current: { setDraftPose: vi.fn() } },
      updateProject,
      setSelection: vi.fn(),
      markDirty,
      workflowActor: { send: vi.fn() },
      executeCommand: (cmd) => { if (cmd.type === 'updateProject') updateProject(cmd.payload.mutator); },
    });

    adapter._startBoneDrag({ clientX: 100, clientY: 100 }, 'b1');
    expect(adapter._dragState.type).toBe('boneMove');
    expect(adapter._dragState.boneId).toBe('b1');

    adapter._onDragMove({ clientX: 120, clientY: 110 });
    adapter._onDragMove({ clientX: 140, clientY: 130 });
    expect(project.bones[0].setup.x).toBe(20);
    expect(project.bones[0].setup.y).toBe(15);
    expect(project.nodes[1].transform.x).toBe(20);
    expect(project.nodes[1].transform.y).toBe(15);
    expect(project.nodes[2].transform.x).toBe(50);
    expect(project.nodes[2].transform.y).toBe(0);
    expect(markDirty).toHaveBeenCalled();

    adapter._onDragEnd();
    expect(updateProject).toHaveBeenCalled();
  });

  it('rotates selected bone on Pixi boneRotate drag and applies startAngle initialization', () => {
    const project = {
      nodes: [
        { id: 'arm', type: 'group', transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 } },
        { id: 'part-1', type: 'part', boneId: 'b1', transform: { x: 100, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 } },
      ],
      bones: [
        { id: 'b1', nodeId: 'arm', setup: { x: 0, y: 0, rotation: 0, length: 100 } },
      ],
    };
    const adapter = new PixiInteractionSystem({
      viewportBridge: {
        app: { canvas: { getBoundingClientRect: () => ({ left: 0, top: 0 }) } },
        viewport: { plugins: { pause: vi.fn(), resume: vi.fn() } },
        toWorld: (x, y) => ({ x, y }),
      },
      overlayLayer: {
        addChild: vi.fn((child) => { child.parent = adapter.overlayLayer; }),
        removeChild: vi.fn((child) => { child.parent = null; }),
      },
      projectRef: { current: project },
      editorRef: { current: { selection: ['b1'], activeBoneId: 'b1', skeletonEditMode: false, editorMode: 'staging', view: { zoom: 1 } } },
      animationRef: { current: { setDraftPose: vi.fn() } },
      updateProject: vi.fn((recipe) => recipe(project)),
      setSelection: vi.fn(),
      markDirty: vi.fn(),
      workflowActor: { send: vi.fn() },
      executeCommand: (cmd) => { if (cmd.type === 'updateProject') cmd.payload.mutator(project); },
    });

    adapter._startBoneRotate();
    expect(adapter._dragState.type).toBe('boneRotate');

    adapter._onDragMove({ clientX: 100, clientY: 0, shiftKey: false });
    expect(adapter._dragState.startAngle).not.toBeNull();

    adapter._onDragMove({ clientX: 0, clientY: 100 });
    expect(Math.abs(project.bones[0].setup.rotation - 90)).toBeLessThan(0.001);
    expect(Math.abs(project.nodes[1].transform.rotation - 90)).toBeLessThan(0.001);

    adapter._onDragMove({ clientX: -100, clientY: 0 });
    expect(Math.abs(project.bones[0].setup.rotation - 180)).toBeLessThan(0.001);
    expect(Math.abs(project.nodes[1].transform.rotation - 180)).toBeLessThan(0.001);
  });

  it('moves linked image and assigned bone together on Pixi gizmo move', () => {
    const project = {
      nodes: [{
        id: 'part-1',
        type: 'part',
        boneId: 'b1',
        transform: { x: 10, y: 20, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
      }],
      bones: [{ id: 'b1', setup: { x: 0, y: 0, rotation: 0, length: 100 } }],
    };
    const editor = {
      selection: ['part-1'],
      editorMode: 'staging',
      view: { zoom: 2, panX: 0, panY: 0 },
    };
    const updateProject = vi.fn((recipe) => recipe(project, { transformVersion: 0 }));
    const adapter = new PixiInteractionSystem({
      viewportBridge: {
        app: { canvas: { getBoundingClientRect: () => ({ left: 0, top: 0 }) } },
        viewport: { plugins: { pause: vi.fn(), resume: vi.fn() } },
      },
      overlayLayer: {
        addChild: vi.fn((child) => { child.parent = adapter.overlayLayer; }),
        removeChild: vi.fn((child) => { child.parent = null; }),
      },
      projectRef: { current: project },
      editorRef: { current: editor },
      animationRef: { current: { setDraftPose: vi.fn() } },
      updateProject,
      setSelection: vi.fn(),
      markDirty: vi.fn(),
      workflowActor: { send: vi.fn() },
      executeCommand: (cmd) => { if (cmd.type === 'updateProject') updateProject(cmd.payload.mutator); },
    });

    adapter._startMoveDrag({ clientX: 100, clientY: 100 });
    adapter._onDragMove({ clientX: 120, clientY: 110 });
    adapter._onDragMove({ clientX: 140, clientY: 130 });

    expect(project.nodes[0].transform.x).toBe(30);
    expect(project.nodes[0].transform.y).toBe(35);
    expect(project.bones[0].setup.x).toBe(20);
    expect(project.bones[0].setup.y).toBe(15);
    expect(adapter.readPreviewPoseOverrides()).toBeNull();
  });

  it('changes bone length on Pixi boneLength drag and clamps to minimum 10', () => {
    const project = {
      nodes: [
        { id: 'arm', type: 'group', transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 } },
      ],
      bones: [
        { id: 'b1', nodeId: 'arm', setup: { x: 0, y: 0, rotation: 0, length: 100 } },
      ],
    };
    const adapter = new PixiInteractionSystem({
      viewportBridge: {
        app: { canvas: { getBoundingClientRect: () => ({ left: 0, top: 0 }) } },
        viewport: { plugins: { pause: vi.fn(), resume: vi.fn() } },
        toWorld: (x, y) => ({ x, y }),
      },
      overlayLayer: {
        addChild: vi.fn((child) => { child.parent = adapter.overlayLayer; }),
        removeChild: vi.fn((child) => { child.parent = null; }),
      },
      projectRef: { current: project },
      editorRef: { current: { selection: ['b1'], activeBoneId: 'b1', skeletonEditMode: false, editorMode: 'staging', view: { zoom: 1 } } },
      animationRef: { current: { setDraftPose: vi.fn() } },
      updateProject: vi.fn((recipe) => recipe(project)),
      setSelection: vi.fn(),
      markDirty: vi.fn(),
      workflowActor: { send: vi.fn() },
      executeCommand: (cmd) => { if (cmd.type === 'updateProject') cmd.payload.mutator(project); },
    });

    adapter._startBoneLength({ clientX: 100, clientY: 100 });
    expect(adapter._dragState.type).toBe('boneLength');

    adapter._onDragMove({ clientX: 200, clientY: 100 });
    expect(project.bones[0].setup.length).toBe(200);

    adapter._onDragMove({ clientX: -1000, clientY: 100 });
    expect(project.bones[0].setup.length).toBe(10);
  });

  it('uses shared workflow actor when provided via constructor', () => {
    const project = {
      nodes: [{
        id: 'part-1',
        type: 'part',
        transform: { x: 10, y: 20, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
      }],
    };
    const editor = {
      selection: ['part-1'],
      editorMode: 'staging',
      view: { zoom: 2, panX: 0, panY: 0 },
    };
    const sharedSend = vi.fn();
    const sharedActor = { send: sharedSend };

    const adapter = new PixiInteractionSystem({
      viewportBridge: {
        app: { canvas: { getBoundingClientRect: () => ({ left: 0, top: 0 }) } },
        viewport: { plugins: { pause: vi.fn(), resume: vi.fn() } },
      },
      overlayLayer: {
        addChild: vi.fn((child) => { child.parent = adapter.overlayLayer; }),
        removeChild: vi.fn((child) => { child.parent = null; }),
      },
      projectRef: { current: project },
      editorRef: { current: editor },
      animationRef: { current: {} },
      updateProject: vi.fn(),
      setSelection: vi.fn(),
      markDirty: vi.fn(),
      executeCommand: vi.fn(),
      workflowActor: sharedActor,
    });

    adapter._sendWorkflow({ type: 'COMMIT_GESTURE' });
    expect(sharedSend).toHaveBeenCalledWith({ type: 'COMMIT_GESTURE' });
  });

  it('stores the provided workflow actor ref', () => {
    const actor = { send: vi.fn() };
    const adapter = new PixiInteractionSystem({
      viewportBridge: {},
      overlayLayer: {
        addChild: vi.fn((child) => { child.parent = adapter.overlayLayer; }),
        removeChild: vi.fn((child) => { child.parent = null; }),
      },
      projectRef: { current: { nodes: [] } },
      editorRef: { current: { selection: [], view: { zoom: 1 } } },
      animationRef: { current: {} },
      updateProject: vi.fn(),
      setSelection: vi.fn(),
      markDirty: vi.fn(),
      workflowActor: actor,
      executeCommand: vi.fn(),
    });

    expect(adapter._workflowActor).toBe(actor);
  });

  it('throws when workflowActor is missing', () => {
    expect(() => new PixiInteractionSystem({
      viewportBridge: {},
      overlayLayer: { addChild: vi.fn(), removeChild: vi.fn() },
      projectRef: { current: { nodes: [] } },
      editorRef: { current: { selection: [], view: { zoom: 1 } } },
      animationRef: { current: {} },
      updateProject: vi.fn(),
      setSelection: vi.fn(),
      markDirty: vi.fn(),
      executeCommand: vi.fn(),
    })).toThrow('PixiInteractionSystem requires a workflowActor ref');
  });

  it('throws when executeCommand is missing', () => {
    expect(() => new PixiInteractionSystem({
      viewportBridge: {},
      overlayLayer: { addChild: vi.fn(), removeChild: vi.fn() },
      projectRef: { current: { nodes: [] } },
      editorRef: { current: { selection: [], view: { zoom: 1 } } },
      animationRef: { current: {} },
      updateProject: vi.fn(),
      setSelection: vi.fn(),
      markDirty: vi.fn(),
      workflowActor: { send: vi.fn() },
    })).toThrow('PixiInteractionSystem requires an executeCommand function');
  });

  it('sends CANCEL_GESTURE on dispose when actively dragging', () => {
    const sharedSend = vi.fn();
    const sharedActor = { send: sharedSend };

    const adapter = new PixiInteractionSystem({
      viewportBridge: {},
      overlayLayer: {
        addChild: vi.fn((child) => { child.parent = adapter.overlayLayer; }),
        removeChild: vi.fn((child) => { child.parent = null; }),
      },
      projectRef: { current: { nodes: [] } },
      editorRef: { current: { selection: [], view: { zoom: 1 } } },
      animationRef: { current: {} },
      updateProject: vi.fn(),
      setSelection: vi.fn(),
      markDirty: vi.fn(),
      executeCommand: vi.fn(),
      workflowActor: sharedActor,
    });

    adapter._dragState = { type: 'move' };

    adapter.dispose();

    expect(sharedSend).toHaveBeenCalledWith({ type: 'CANCEL_GESTURE' });
    expect(adapter._dragState).toBeNull();
    expect(adapter._workflowActor).toBeNull();
  });

  it('does not send CANCEL_GESTURE on dispose when not dragging', () => {
    const sharedSend = vi.fn();
    const sharedActor = { send: sharedSend };

    const adapter = new PixiInteractionSystem({
      viewportBridge: {},
      overlayLayer: {
        addChild: vi.fn((child) => { child.parent = adapter.overlayLayer; }),
        removeChild: vi.fn((child) => { child.parent = null; }),
      },
      projectRef: { current: { nodes: [] } },
      editorRef: { current: { selection: [], view: { zoom: 1 } } },
      animationRef: { current: {} },
      updateProject: vi.fn(),
      setSelection: vi.fn(),
      markDirty: vi.fn(),
      executeCommand: vi.fn(),
      workflowActor: sharedActor,
    });

    adapter.dispose();

    expect(sharedSend).not.toHaveBeenCalled();
    expect(adapter._workflowActor).toBeNull();
  });

  it('binds base gestures to Pixi stage instead of DOM pointer listeners', () => {
    const listeners = new Map();
    const executeCommand = vi.fn();
    const stage = {
      on: vi.fn((event, fn) => listeners.set(event, fn)),
      off: vi.fn((event, fn) => {
        if (listeners.get(event) === fn) listeners.delete(event);
      }),
    };
    const adapter = new PixiInteractionSystem({
      viewportBridge: {
        app: {
          stage,
          screen: { x: 0, y: 0, width: 800, height: 600 },
          canvas: { getBoundingClientRect: () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }) },
        },
        viewport: { plugins: { pause: vi.fn(), resume: vi.fn() } },
        toWorld: (x, y) => ({ x, y }),
      },
      overlayLayer: { addChild: vi.fn(), removeChild: vi.fn() },
      projectRef: { current: { nodes: [], bones: [], constraints: [], animations: [] } },
      editorRef: {
        current: {
          activeTool: 'select',
          selectionTarget: 'element',
          selection: [],
          meshEditMode: false,
          weightPaintMode: false,
          hoverHit: 'panel-hover',
          view: { zoom: 1 },
        },
      },
      animationRef: { current: { draftPose: new Map() } },
      updateProject: vi.fn(),
      setSelection: vi.fn(),
      markDirty: vi.fn(),
      workflowActor: { send: vi.fn() },
      executeCommand,
    });

    adapter.bind();

    expect(stage.eventMode).toBe('static');
    expect(stage.hitArea).toBe(adapter.viewportBridge.app.screen);
    expect([...listeners.keys()]).toEqual(expect.arrayContaining([
      'pointerdown',
      'globalpointermove',
      'pointerup',
      'pointerupoutside',
      'pointercancel',
    ]));

    listeners.get('globalpointermove')({ clientX: -20, clientY: 200 });
    expect(executeCommand).not.toHaveBeenCalled();

    listeners.get('globalpointermove')({ clientX: 20, clientY: 200 });
    expect(executeCommand).toHaveBeenCalledWith({ type: 'setHover', payload: { hit: null } });
    executeCommand.mockClear();

    adapter._dragState = {
      type: 'drawBone',
      startWorldX: 10,
      startWorldY: 10,
      endWorldX: 100,
      endWorldY: 100,
    };
    listeners.get('pointerupoutside')({ button: 0 });
    expect(adapter._dragState).toBeNull();
    expect(adapter.projectRef.current.bones).toHaveLength(0);

    adapter.dispose();
    expect(listeners.size).toBe(0);
  });

  it('dispose cleans up pending drag, preview poses, viewport drag and listeners', () => {
    const resumeMock = vi.fn();

    const adapter = new PixiInteractionSystem({
      viewportBridge: {},
      overlayLayer: {
        addChild: vi.fn(),
        removeChild: vi.fn(),
      },
      projectRef: { current: { nodes: [] } },
      editorRef: { current: { selection: [], view: { zoom: 1 } } },
      animationRef: { current: {} },
      updateProject: vi.fn(),
      setSelection: vi.fn(),
      markDirty: vi.fn(),
      workflowActor: { send: vi.fn() },
      executeCommand: vi.fn(),
    });

    adapter._viewportDragPaused = true;
    adapter.viewportBridge = { viewport: { plugins: { resume: resumeMock } } };
    adapter._setPreviewPose('node1', { x: 5 });
    adapter._pendingDragEvent = { type: 'move' };
    const mockFn = vi.fn();
    adapter._boundListeners.push(
      { target: {}, event: 'pointermove', fn: mockFn },
      { target: {}, event: 'pointerup', fn: mockFn },
    );

    adapter.dispose();

    expect(adapter._pendingDragEvent).toBeNull();
    expect(adapter._previewPoseOverrides.size).toBe(0);
    expect(resumeMock).toHaveBeenCalledWith('drag');
    expect(adapter._boundListeners).toEqual([]);
  });

  it('moves linked image in Animation mode without setup mutation and persists pre-link offset', () => {
    const project = {
      nodes: [{
        id: 'part-1', type: 'part', boneId: 'b1',
        transform: { x: 10, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
        visible: true, opacity: 1,
      }],
      bones: [{ id: 'b1', parentId: null, setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, length: 10 } }],
      constraints: [],
      animations: [{ id: 'anim1', tracks: [] }],
    };
    const editor = {
      selection: ['part-1'],
      editorMode: 'animation',
      view: { zoom: 1, panX: 0, panY: 0 },
    };
    const animState = {
      activeAnimationId: 'anim1',
      currentTime: 0,
      draftPose: new Map(),
      draftDirty: false,
      draftRevision: 0,
      fps: 30,
      endFrame: 0,
      loopKeyframes: false,
    };
    const markDirty = vi.fn();
    const previewOverrides = new Map();
    const previewPartial = vi.fn((targetId, partial) => {
      const existing = previewOverrides.get(targetId) ?? {};
      previewOverrides.set(targetId, { ...existing, ...partial });
      return { valid: true };
    });
    const commitGesture = vi.fn(() => ({ changed: false }));

    const adapter = new PixiInteractionSystem({
      viewportBridge: {
        app: { canvas: { getBoundingClientRect: () => ({ left: 0, top: 0 }) } },
        viewport: { plugins: { pause: vi.fn(), resume: vi.fn() } },
        toWorld: (x, y) => ({ x, y }),
      },
      overlayLayer: {
        addChild: vi.fn((child) => { child.parent = adapter.overlayLayer; }),
        removeChild: vi.fn((child) => { child.parent = null; }),
      },
      projectRef: { current: project },
      editorRef: { current: editor },
      animationRef: { current: animState },
      animationAuthoringAdapter: { previewPartial, commitGesture, beginGesture: vi.fn(() => 'test-gesture') },
      updateProject: vi.fn(),
      setSelection: vi.fn(),
      markDirty,
      workflowActor: { send: vi.fn() },
      executeCommand: vi.fn(),
    });

    const preLinkedNodes = [{
      id: 'part-1', type: 'part', boneId: 'b1',
      transform: { x: 10, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
      visible: true, opacity: 1,
    }];
    adapter.updateFramePose({
      effectiveNodes: [{
        id: 'part-1', type: 'part', boneId: 'b1',
        transform: { x: 10, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
        visible: true, opacity: 1,
      }],
      effectiveBones: [{ id: 'b1', parentId: null, setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, length: 10 } }],
      preLinkedNodes,
      poseOverrides: new Map(),
    });

    adapter._startMoveDrag({ clientX: 100, clientY: 100 });
    expect(adapter._dragState.type).toBe('move');
    expect(adapter._dragState.linkedAnim).toBe(true);

    adapter._onDragMove({ clientX: 120, clientY: 110 });

    expect(previewPartial).toHaveBeenCalled();
    expect(project.nodes[0].transform.x).toBe(10);
    expect(project.nodes[0].transform.y).toBe(0);

    adapter._onDragEnd();
    expect(markDirty).toHaveBeenCalled();
  });
});
