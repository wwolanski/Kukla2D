import { describe, expect, it, vi } from 'vitest';
import {
  handleCanvasGestureCancel as cancelCanvasGesture,
  handleCanvasPointerDown as onCanvasPointerDown,
  handleCanvasPointerMove as onCanvasPointerMove,
  handleCanvasPointerUp as onCanvasPointerUp,
} from '@/features/canvas/infrastructure/rendering/pixi/PixiCanvasGestures.js';
import { getWarpGrid } from '@/features/canvas/infrastructure/rendering/pixi/PixiInputState.js';
import { resolveEditorCommands } from '@/features/canvas/domain/resolveEditorCommands.js';
import {
  shouldCaptureSelectedBone,
  shouldCaptureSelectedPart,
} from '@/features/canvas/infrastructure/rendering/pixi/PixiInputHandles.js';

function createAdapter(editorOverrides = {}, projectOverrides = {}) {
  const project = {
    nodes: [],
    bones: [],
    constraints: [],
    animations: [],
    ...projectOverrides,
  };
  const editor = {
    activeTool: 'select',
    selectionTarget: 'element',
    selection: [],
    meshEditMode: false,
    weightPaintMode: false,
    blendShapeEditMode: false,
    editorMode: 'staging',
    drawBoneAutoAssign: true,
    drawBoneAutoAssignMode: 'smart',
    view: { zoom: 1, panX: 0, panY: 0 },
    ...editorOverrides,
  };
  const commands = [];
  const workflow = [];
  const adapter = {
    projectRef: { current: project },
    editorRef: { current: editor },
    animationRef: { current: { draftPose: new Map(), setDraftPose: vi.fn() } },
    imageDataByPartId: new Map(),
    markDirty: vi.fn(),
    _dragState: null,
    _startBoneDrag: vi.fn(),
    _projectSnapshot: null,
    _framePose: null,
    readFramePose() { return this._framePose; },
    _eventWorldPosition: event => event.world,
    _captureGestureSnapshot() {
      this._projectSnapshot ??= structuredClone(project);
    },
    _setDragState(state) {
      this._captureGestureSnapshot();
      this._dragState = state;
    },
    _restoreGestureSnapshot() {
      if (this._projectSnapshot) {
        for (const key of Object.keys(project)) delete project[key];
        Object.assign(project, structuredClone(this._projectSnapshot));
      }
      this._clearGestureSnapshot();
    },
    _clearGestureSnapshot() { this._projectSnapshot = null; },
    _clearPreviewPose: vi.fn(),
    _resumeViewportDrag: vi.fn(),
    _sendWorkflow(event) {
      workflow.push(event);
      for (const command of resolveEditorCommands({ event, context: { marqueeBox: editor.marqueeBox } })) {
        this._executeCommand(command);
      }
    },
    _beginCommandBatch: meta => commands.push({ type: 'beginBatch', payload: { meta } }),
    _endCommandBatch: () => commands.push({ type: 'endBatch', payload: {} }),
    _executeCommand(command) {
      commands.push(command);
      if (command.type === 'setMarquee') editor.marqueeBox = command.payload.box;
      if (command.type === 'setDrawBonePreview') editor.drawBonePreview = command.payload.preview;
      if (command.type === 'setSelection') editor.selection = command.payload.ids;
      if (command.type === 'setInteraction') editor.interaction = command.payload.interaction;
      if (command.type === 'setHover') editor.hoverHit = command.payload.hit;
      if (command.type === 'setRigSelection') {
        editor.selection = [
          ...(command.payload.elementIds ?? []),
          ...(command.payload.boneIds ?? []),
          ...(command.payload.constraintIds ?? []),
        ];
        editor.activeBoneId = command.payload.activeBoneId ?? null;
        editor.activeConstraintId = command.payload.activeConstraintId ?? null;
      }
      if (command.type === 'updateProject') command.payload.mutator(project);
    },
  };
  return { adapter, commands, workflow, project, editor };
}

describe('getWarpGrid', () => {
  it('falls back to rest grid when no draft or override exists', () => {
    const wdNode = {
      id: 'w1', col: 1, row: 1, gridX: 0, gridY: 0, gridW: 100, gridH: 100,
    };
    const grid = getWarpGrid({ wdNode, animation: { draftPose: new Map() } });
    expect(grid).toHaveLength(4);
    expect(grid[0]).toEqual({ x: 0, y: 0 });
    expect(grid[3]).toEqual({ x: 100, y: 100 });
  });

  it('prefers draft pose mesh_verts over rest grid', () => {
    const wdNode = {
      id: 'w1', col: 1, row: 1, gridX: 0, gridY: 0, gridW: 100, gridH: 100,
    };
    const draft = new Map([['w1', {
      mesh_verts: [{ x: 5, y: 5 }, { x: 95, y: 5 }, { x: 5, y: 95 }, { x: 95, y: 95 }],
    }]]);
    const grid = getWarpGrid({ wdNode, animation: { draftPose: draft } });
    expect(grid[0]).toEqual({ x: 5, y: 5 });
    expect(grid[3]).toEqual({ x: 95, y: 95 });
  });

  it('uses pose override when draft is empty', () => {
    const wdNode = {
      id: 'w1', col: 1, row: 1, gridX: 0, gridY: 0, gridW: 100, gridH: 100,
    };
    const poseOverrides = new Map([['w1', {
      mesh_verts: [{ x: 10, y: 10 }, { x: 90, y: 10 }, { x: 10, y: 90 }, { x: 90, y: 90 }],
    }]]);
    const grid = getWarpGrid({ wdNode, animation: { draftPose: new Map() }, poseOverrides });
    expect(grid[0]).toEqual({ x: 10, y: 10 });
  });
});

describe('Pixi canvas gestures', () => {
  it('lets a topmost overlapping part bypass the selected part move area', () => {
    const transform = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 };
    const { adapter } = createAdapter({ selection: ['lower'] }, {
      nodes: [
        { id: 'lower', type: 'part', draw_order: 0, transform },
        { id: 'upper', type: 'part', draw_order: 1, transform },
      ],
    });
    const opaque = {
      width: 20,
      height: 20,
      data: new Uint8ClampedArray(20 * 20 * 4).fill(255),
    };
    adapter.imageDataByPartId.set('lower', opaque);
    adapter.imageDataByPartId.set('upper', opaque);

    expect(shouldCaptureSelectedPart(adapter, { world: { x: 10, y: 10 } }, 'lower')).toBe(false);
    expect(shouldCaptureSelectedPart(adapter, { world: { x: 10, y: 10 } }, 'upper')).toBe(true);
  });

  it('lets bones and IK constraints bypass active selection handles', () => {
    const { adapter } = createAdapter({
      selection: ['part-1'],
      selectionTarget: 'all',
      activeBoneId: 'bone-1',
    }, {
      nodes: [{
        id: 'part-1',
        type: 'part',
        draw_order: 0,
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
      }],
      bones: [
        { id: 'bone-1', setup: { x: 0, y: 10, rotation: 0, length: 20 } },
        { id: 'bone-2', setup: { x: 0, y: 10, rotation: 0, length: 20 } },
      ],
      constraints: [{
        id: 'ik-1',
        type: 'ik',
        targetX: 10,
        targetY: 10,
      }],
    });
    adapter.imageDataByPartId.set('part-1', {
      width: 20,
      height: 20,
      data: new Uint8ClampedArray(20 * 20 * 4).fill(255),
    });

    const event = { world: { x: 10, y: 10 } };
    expect(shouldCaptureSelectedPart(adapter, event, 'part-1')).toBe(false);
    expect(shouldCaptureSelectedBone(adapter, event, 'bone-1')).toBe(false);

    adapter.projectRef.current.constraints = [];
    expect(shouldCaptureSelectedBone(adapter, event, 'bone-1')).toBe(false);
    expect(shouldCaptureSelectedBone(adapter, event, 'bone-2')).toBe(false);
    adapter.editorRef.current.selection = ['bone-2'];
    adapter.editorRef.current.activeBoneId = 'bone-2';
    expect(shouldCaptureSelectedBone(adapter, event, 'bone-2')).toBe(true);
  });

  it('picks bones from the rendered pose instead of stale setup coordinates', () => {
    const { adapter, editor } = createAdapter({
      activeTool: 'pose',
      selectionTarget: 'rig',
    }, {
      bones: [{
        id: 'bone-1',
        setup: { x: 0, y: 0, rotation: 0, length: 30 },
      }],
    });
    adapter._framePose = {
      effectiveNodes: [],
      effectiveBones: [{
        id: 'bone-1',
        setup: { x: 100, y: 50, rotation: 0, length: 30 },
      }],
      poseOverrides: new Map(),
    };

    onCanvasPointerMove(adapter, { world: { x: 110, y: 50 } });
    expect(editor.hoverHit).toBe('bone:bone-1');

    onCanvasPointerDown(adapter, { button: 0, world: { x: 110, y: 50 } });

    expect(editor.selection).toEqual(['bone-1']);
    expect(editor.activeBoneId).toBe('bone-1');
    expect(adapter._startBoneDrag).not.toHaveBeenCalled();
  });

  it('runs marquee from Pixi pointer events and selects intersecting parts', () => {
    const { adapter, commands, workflow, editor } = createAdapter({}, {
      nodes: [{
        id: 'part-1',
        type: 'part',
        imageWidth: 100,
        imageHeight: 100,
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
      }],
    });

    onCanvasPointerDown(adapter, { button: 0, world: { x: -10, y: -10 } });
    onCanvasPointerMove(adapter, { world: { x: 50, y: 50 } });
    expect(adapter._dragState.type).toBe('marquee');
    expect(editor.marqueeBox).toEqual({ x: -10, y: -10, w: 60, h: 60 });

    expect(onCanvasPointerUp(adapter)).toBe(true);
    expect(editor.selection).toEqual(['part-1']);
    expect(workflow.at(-1)).toEqual({ type: 'COMMIT_MARQUEE' });
    expect(commands.some(command => command.type === 'setSelection')).toBe(true);
  });

  it('creates and selects a bone through Pixi draw gesture', () => {
    const { adapter, project, editor, workflow } = createAdapter({
      activeTool: 'drawBone',
      riggingTool: 'draw',
      toolMode: 'draw_bone',
    });

    onCanvasPointerDown(adapter, { button: 0, world: { x: 10, y: 20 } });
    onCanvasPointerMove(adapter, { world: { x: 110, y: 20 } });
    expect(editor.drawBonePreview.endX).toBe(110);

    onCanvasPointerUp(adapter);
    expect(project.bones).toHaveLength(1);
    expect(project.bones[0].setup.length).toBe(100);
    expect(workflow.at(-1)).toEqual({ type: 'COMMIT_GESTURE' });
  });

  it('draws over artwork and opens auto-assign prompt for alpha hits', () => {
    const { adapter, project, editor } = createAdapter({
      activeTool: 'drawBone',
      riggingTool: 'draw',
      toolMode: 'draw_bone',
      selectionTarget: 'rig',
    }, {
      nodes: [{
        id: 'part-1',
        type: 'part',
        imageWidth: 100,
        imageHeight: 100,
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
      }],
    });
    adapter.imageDataByPartId.set('part-1', {
      width: 100,
      height: 100,
      data: new Uint8ClampedArray(100 * 100 * 4).fill(255),
    });

    onCanvasPointerDown(adapter, { button: 0, world: { x: 10, y: 50 } });
    onCanvasPointerMove(adapter, { world: { x: 90, y: 50 } });
    onCanvasPointerUp(adapter, { button: 0 });

    expect(project.bones).toHaveLength(1);
    expect(editor.interaction).toEqual({
      kind: 'pendingAssignBone',
      boneId: project.bones[0].id,
      candidateNodeIds: ['part-1'],
    });
  });

  it('never starts bone drawing from right-click or modified left-click', () => {
    const { adapter } = createAdapter({
      activeTool: 'drawBone',
      riggingTool: 'draw',
      toolMode: 'draw_bone',
    });

    onCanvasPointerDown(adapter, { button: 2, world: { x: 10, y: 20 } });
    expect(adapter._dragState).toBeNull();

    onCanvasPointerDown(adapter, { button: 0, shiftKey: true, world: { x: 10, y: 20 } });
    expect(adapter._dragState).toBeNull();
  });

  it('does not commit an active bone draw on right-button release', () => {
    const { adapter, project } = createAdapter({
      activeTool: 'drawBone',
      riggingTool: 'draw',
      toolMode: 'draw_bone',
    });

    onCanvasPointerDown(adapter, { button: 0, world: { x: 10, y: 20 } });
    onCanvasPointerMove(adapter, { world: { x: 110, y: 20 } });

    expect(onCanvasPointerUp(adapter, { button: 2 })).toBe(true);
    expect(project.bones).toHaveLength(0);
    expect(adapter._dragState.type).toBe('drawBone');
  });

  it('cancels transient bone preview when tool changes to Select', () => {
    const { adapter, editor, project, workflow } = createAdapter({
      activeTool: 'drawBone',
      riggingTool: 'draw',
      toolMode: 'draw_bone',
    });

    onCanvasPointerDown(adapter, { button: 0, world: { x: 10, y: 20 } });
    onCanvasPointerMove(adapter, { world: { x: 110, y: 20 } });
    editor.activeTool = 'select';
    editor.riggingTool = 'select';
    editor.toolMode = 'select';

    onCanvasPointerMove(adapter, { world: { x: 130, y: 20 } });

    expect(adapter._dragState).toBeNull();
    expect(adapter._drawBonePreview).toBeNull();
    expect(editor.drawBonePreview).toBeNull();
    expect(project.bones).toHaveLength(0);
    expect(workflow.at(-1)).toEqual({ type: 'CANCEL_GESTURE' });
  });

  it('ALL target selects bones and marquee-selects elements, bones, and constraints', () => {
    const { adapter, editor } = createAdapter({
      selectionTarget: 'all',
    }, {
      nodes: [{
        id: 'part-1',
        type: 'part',
        imageWidth: 20,
        imageHeight: 20,
        transform: { x: 30, y: 30, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
      }],
      bones: [{
        id: 'bone-1',
        setup: { x: 10, y: 10, rotation: 0, length: 30 },
      }],
      constraints: [{ id: 'constraint-1', targetBoneId: 'bone-1' }],
    });

    onCanvasPointerDown(adapter, { button: 0, world: { x: 15, y: 10 } });
    expect(editor.selection).toEqual(['bone-1']);

    onCanvasPointerDown(adapter, { button: 0, world: { x: -10, y: -10 } });
    onCanvasPointerMove(adapter, { world: { x: 60, y: 60 } });
    onCanvasPointerUp(adapter);

    expect(editor.selection).toEqual(['part-1', 'bone-1', 'constraint-1']);
  });

  it('ALL target selects an alpha-hit part instead of starting a marquee', () => {
    const imageData = {
      width: 20,
      height: 20,
      data: new Uint8ClampedArray(20 * 20 * 4).fill(255),
    };
    const { adapter, editor, workflow } = createAdapter({
      selectionTarget: 'all',
    }, {
      nodes: [{
        id: 'part-1',
        type: 'part',
        imageWidth: 20,
        imageHeight: 20,
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
      }],
    });
    adapter.imageDataByPartId.set('part-1', imageData);

    onCanvasPointerDown(adapter, { button: 0, world: { x: 10, y: 10 } });

    expect(adapter._dragState).toBeNull();
    expect(editor.selection).toEqual(['part-1']);
    expect(workflow.at(-1)).toEqual({ type: 'SELECT_HIT', partId: 'part-1' });
  });

  it('auto motion canvas pick hovers and selects alpha-hit parts without drag', () => {
    const imageData = {
      width: 20,
      height: 20,
      data: new Uint8ClampedArray(20 * 20 * 4).fill(255),
    };
    const { adapter, editor } = createAdapter({
      interaction: { kind: 'pendingPickAutoMotionPart', role: 'chest' },
    }, {
      nodes: [{
        id: 'part-1',
        type: 'part',
        imageWidth: 20,
        imageHeight: 20,
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
      }],
    });
    adapter.imageDataByPartId.set('part-1', imageData);

    onCanvasPointerMove(adapter, { world: { x: 10, y: 10 } });
    expect(editor.hoverHit).toBe('part-1');

    onCanvasPointerDown(adapter, { button: 0, world: { x: 10, y: 10 }, stopPropagation: vi.fn() });

    expect(adapter._dragState).toBeNull();
    expect(editor.selection).toEqual(['part-1']);
    expect(editor.interaction).toEqual({ kind: 'idle' });
    expect(editor.hoverHit).toBeNull();
  });

  it('auto motion point pick returns local click position for cheek area', () => {
    const imageData = {
      width: 40,
      height: 40,
      data: new Uint8ClampedArray(40 * 40 * 4).fill(255),
    };
    const { adapter, editor } = createAdapter({
      interaction: { kind: 'pendingPickAutoMotionPoint', role: 'cheekArea', targetNodeId: 'part-1' },
    }, {
      nodes: [{
        id: 'part-1',
        type: 'part',
        imageWidth: 40,
        imageHeight: 40,
        transform: { x: 100, y: 50, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
      }],
    });
    adapter.imageDataByPartId.set('part-1', imageData);

    onCanvasPointerMove(adapter, { world: { x: 112, y: 68 } });
    expect(editor.hoverHit).toBe('part-1');

    onCanvasPointerDown(adapter, { button: 0, world: { x: 112, y: 68 }, stopPropagation: vi.fn() });

    expect(adapter._dragState).toBeNull();
    expect(editor.selection).toEqual(['part-1']);
    expect(editor.interaction).toEqual({
      kind: 'autoMotionPickResult',
      role: 'cheekArea',
      nodeId: 'part-1',
      localPoint: { x: 12, y: 18 },
      worldPoint: { x: 112, y: 68 },
    });
    expect(editor.hoverHit).toBeNull();
  });

  it('cancel clears Pixi marquee state without committing selection', () => {
    const { adapter, editor, workflow } = createAdapter();
    onCanvasPointerDown(adapter, { button: 0, world: { x: 0, y: 0 } });
    onCanvasPointerMove(adapter, { world: { x: 40, y: 40 } });

    expect(cancelCanvasGesture(adapter)).toBe(true);
    expect(editor.marqueeBox).toBeNull();
    expect(editor.selection).toEqual([]);
    expect(workflow.at(-1)).toEqual({ type: 'CANCEL_GESTURE' });
  });

  it('runs weight paint through command mutations and rolls it back on cancel', () => {
    const node = {
      id: 'part-1',
      type: 'part',
      imageWidth: 100,
      imageHeight: 100,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
      mesh: {
        vertices: [
          { x: 10, y: 10, restX: 10, restY: 10 },
          { x: 80, y: 80, restX: 80, restY: 80 },
          { x: 90, y: 10, restX: 90, restY: 10 },
        ],
        uvs: [0.1, 0.1, 0.8, 0.8, 0.9, 0.1],
        triangles: [[0, 1, 2]],
        edgeIndices: new Set([0, 1, 2]),
      },
    };
    const { adapter, workflow } = createAdapter({
      activeTool: 'weightPaint',
      selection: ['part-1'],
      weightPaintMode: true,
      weightPaintBoneId: 'bone-1',
      weightPaintStrength: 1,
      brushSize: 30,
      brushHardness: 1,
    }, { nodes: [node], bones: [{ id: 'bone-1' }] });

    onCanvasPointerDown(adapter, { button: 0, world: { x: 10, y: 10 } });
    expect(node.mesh.influences[0]).toEqual([{ boneId: 'bone-1', weight: 1 }]);
    expect(workflow[0].type).toBe('START_WEIGHT_PAINT');

    cancelCanvasGesture(adapter);
    expect(adapter.projectRef.current.nodes[0].mesh.influences).toBeUndefined();
    expect(workflow.at(-1)).toEqual({ type: 'CANCEL_GESTURE' });
  });

  it('deforms mesh through Pixi move and commits one gesture lifecycle', () => {
    const node = {
      id: 'part-1',
      type: 'part',
      imageWidth: 100,
      imageHeight: 100,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
      mesh: {
        vertices: [
          { x: 10, y: 10, restX: 10, restY: 10 },
          { x: 80, y: 80, restX: 80, restY: 80 },
          { x: 90, y: 10, restX: 90, restY: 10 },
        ],
        uvs: [0.1, 0.1, 0.8, 0.8, 0.9, 0.1],
        triangles: [[0, 1, 2]],
        edgeIndices: new Set([0, 1, 2]),
      },
    };
    const { adapter, workflow } = createAdapter({
      selection: ['part-1'],
      meshEditMode: true,
      meshSubMode: 'deform',
      brushSize: 40,
      brushHardness: 1,
    }, { nodes: [node] });
    adapter.uploadPositions = vi.fn();

    onCanvasPointerDown(adapter, { button: 0, world: { x: 10, y: 10 } });
    onCanvasPointerMove(adapter, { world: { x: 20, y: 25 } });
    expect(node.mesh.vertices[0].x).toBe(20);
    expect(node.mesh.vertices[0].y).toBe(25);
    expect(adapter.uploadPositions).toHaveBeenCalled();

    onCanvasPointerUp(adapter);
    expect(workflow[0].type).toBe('START_MESH_BRUSH');
    expect(workflow.at(-1)).toEqual({ type: 'COMMIT_GESTURE' });
  });

  it('selects bone over part when both are hit at same coordinates (A1)', () => {
    const imageData = {
      width: 100,
      height: 100,
      data: new Uint8ClampedArray(100 * 100 * 4).fill(255),
    };
    const { adapter, editor } = createAdapter({
      activeTool: 'select',
      selectionTarget: 'all',
      selection: ['part-1'],
    }, {
      nodes: [{
        id: 'part-1',
        type: 'part',
        imageWidth: 100,
        imageHeight: 100,
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
      }],
      bones: [{
        id: 'bone-1',
        setup: { x: 0, y: 0, rotation: 0, length: 100 },
      }],
    });
    adapter.imageDataByPartId.set('part-1', imageData);

    onCanvasPointerDown(adapter, { button: 0, world: { x: 50, y: 0 } });

    expect(editor.selection).toEqual(['bone-1']);
    expect(editor.activeBoneId).toBe('bone-1');
  });

  it('selects topmost part over previously selected part (A2)', () => {
    const smallImageData = {
      width: 20,
      height: 20,
      data: new Uint8ClampedArray(20 * 20 * 4).fill(255),
    };
    const largeImageData = {
      width: 100,
      height: 100,
      data: new Uint8ClampedArray(100 * 100 * 4).fill(255),
    };
    const { adapter, editor } = createAdapter({
      activeTool: 'select',
      selectionTarget: 'element',
      selection: ['large-part'],
    }, {
      nodes: [
        {
          id: 'large-part',
          type: 'part',
          imageWidth: 100,
          imageHeight: 100,
          draw_order: 1,
          transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
        },
        {
          id: 'small-part',
          type: 'part',
          imageWidth: 20,
          imageHeight: 20,
          draw_order: 10,
          transform: { x: 10, y: 10, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
        },
      ],
    });
    adapter.imageDataByPartId.set('large-part', largeImageData);
    adapter.imageDataByPartId.set('small-part', smallImageData);

    onCanvasPointerDown(adapter, { button: 0, world: { x: 15, y: 15 } });

    expect(editor.selection).toEqual(['small-part']);
  });

  it('mesh edit mode does not consume click when bone is hit', () => {
    const imageData = {
      width: 100,
      height: 100,
      data: new Uint8ClampedArray(100 * 100 * 4).fill(255),
    };
    const node = {
      id: 'part-1',
      type: 'part',
      imageWidth: 100,
      imageHeight: 100,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
      mesh: {
        vertices: [
          { x: 10, y: 10, restX: 10, restY: 10 },
          { x: 80, y: 80, restX: 80, restY: 80 },
          { x: 90, y: 10, restX: 90, restY: 10 },
        ],
        uvs: [0.1, 0.1, 0.8, 0.8, 0.9, 0.1],
        triangles: [[0, 1, 2]],
        edgeIndices: new Set([0, 1, 2]),
      },
    };
    const { adapter, editor } = createAdapter({
      activeTool: 'select',
      selectionTarget: 'all',
      selection: ['part-1'],
      meshEditMode: true,
      meshSubMode: 'deform',
    }, {
      nodes: [node],
      bones: [{
        id: 'bone-1',
        setup: { x: 0, y: 0, rotation: 0, length: 100 },
      }],
    });
    adapter.imageDataByPartId.set('part-1', imageData);

    onCanvasPointerDown(adapter, { button: 0, world: { x: 50, y: 0 } });

    expect(editor.selection).toEqual(['bone-1']);
  });

  it('mesh edit mode does not consume click when no mesh node is selected', () => {
    const imageData = {
      width: 100,
      height: 100,
      data: new Uint8ClampedArray(100 * 100 * 4).fill(255),
    };
    const { adapter, editor } = createAdapter({
      activeTool: 'select',
      selectionTarget: 'element',
      selection: [],
      meshEditMode: true,
    }, {
      nodes: [{
        id: 'part-1',
        type: 'part',
        imageWidth: 100,
        imageHeight: 100,
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
      }],
    });
    adapter.imageDataByPartId.set('part-1', imageData);

    onCanvasPointerDown(adapter, { button: 0, world: { x: 50, y: 50 } });

    expect(editor.selection).toEqual(['part-1']);
  });

  it('does not start weight paint gesture without bone id', () => {
    const node = {
      id: 'part-1',
      type: 'part',
      imageWidth: 100,
      imageHeight: 100,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
      mesh: {
        vertices: [
          { x: 10, y: 10, restX: 10, restY: 10 },
          { x: 80, y: 80, restX: 80, restY: 80 },
          { x: 90, y: 10, restX: 90, restY: 10 },
        ],
        uvs: [0.1, 0.1, 0.8, 0.8, 0.9, 0.1],
        triangles: [[0, 1, 2]],
        edgeIndices: new Set([0, 1, 2]),
      },
    };
    const { adapter } = createAdapter({
      activeTool: 'weightPaint',
      selection: ['part-1'],
      weightPaintMode: true,
      weightPaintBoneId: null,
      weightPaintStrength: 1,
      brushSize: 30,
      brushHardness: 1,
    }, { nodes: [node] });

    onCanvasPointerDown(adapter, { button: 0, world: { x: 10, y: 10 } });
    expect(adapter._dragState).toBeNull();
  });

  it('blocks weight paint in animation mode', () => {
    const node = {
      id: 'part-1',
      type: 'part',
      imageWidth: 100,
      imageHeight: 100,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
      mesh: {
        vertices: [
          { x: 10, y: 10, restX: 10, restY: 10 },
          { x: 80, y: 80, restX: 80, restY: 80 },
          { x: 90, y: 10, restX: 90, restY: 10 },
        ],
        uvs: [0.1, 0.1, 0.8, 0.8, 0.9, 0.1],
        triangles: [[0, 1, 2]],
        edgeIndices: new Set([0, 1, 2]),
      },
    };
    const { adapter } = createAdapter({
      activeTool: 'weightPaint',
      selection: ['part-1'],
      weightPaintMode: true,
      weightPaintBoneId: 'bone-1',
      editorMode: 'animation',
      weightPaintStrength: 1,
      brushSize: 30,
      brushHardness: 1,
    }, { nodes: [node], bones: [{ id: 'bone-1' }] });

    onCanvasPointerDown(adapter, { button: 0, world: { x: 10, y: 10 } });
    expect(adapter._dragState).toBeNull();
  });

  it('previews mesh_verts in animation mode and commits keyframe on pointer up', () => {
    const node = {
      id: 'part-1',
      type: 'part',
      imageWidth: 100,
      imageHeight: 100,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
      mesh: {
        vertices: [
          { x: 10, y: 10, restX: 10, restY: 10 },
          { x: 80, y: 80, restX: 80, restY: 80 },
          { x: 90, y: 10, restX: 90, restY: 10 },
        ],
        uvs: [0.1, 0.1, 0.8, 0.8, 0.9, 0.1],
        triangles: [[0, 1, 2]],
        edgeIndices: new Set([0, 1, 2]),
      },
    };
    const previewPartial = vi.fn();
    const commitGesture = vi.fn(() => ({ changed: true }));
    const { adapter } = createAdapter({
      selection: ['part-1'],
      meshEditMode: true,
      meshSubMode: 'deform',
      editorMode: 'animation',
      autoKeyframe: true,
      brushSize: 40,
      brushHardness: 1,
    }, { nodes: [node] });
    adapter.animationAuthoringAdapter = { previewPartial, commitGesture };

    onCanvasPointerDown(adapter, { button: 0, world: { x: 10, y: 10 } });
    onCanvasPointerMove(adapter, { world: { x: 20, y: 25 } });
    expect(previewPartial).toHaveBeenCalledWith('part-1', { mesh_verts: expect.any(Array) });

    onCanvasPointerUp(adapter);
    expect(commitGesture).toHaveBeenCalledWith({ source: 'auto-key' });
  });

  it('blocks add vertex in animation mode', () => {
    const node = {
      id: 'part-1',
      type: 'part',
      imageWidth: 100,
      imageHeight: 100,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
      mesh: {
        vertices: [
          { x: 10, y: 10, restX: 10, restY: 10 },
          { x: 80, y: 80, restX: 80, restY: 80 },
          { x: 90, y: 10, restX: 90, restY: 10 },
        ],
        uvs: [0.1, 0.1, 0.8, 0.8, 0.9, 0.1],
        triangles: [[0, 1, 2]],
        edgeIndices: new Set([0, 1, 2]),
      },
    };
    const { adapter } = createAdapter({
      selection: ['part-1'],
      meshEditMode: true,
      meshSubMode: 'deform',
      editorMode: 'animation',
      toolMode: 'add_vertex',
    }, { nodes: [node] });

    onCanvasPointerDown(adapter, { button: 0, world: { x: 50, y: 50 } });
    expect(adapter._dragState).toBeNull();
    expect(node.mesh.vertices).toHaveLength(3);
  });

  it('commits warp drag to defaultPose in staging mode', () => {
    const wdNode = {
      id: 'w1', type: 'warpDeformer',
      col: 1, row: 1, gridX: 0, gridY: 0, gridW: 100, gridH: 100,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
      visible: true, opacity: 1,
    };
    const { adapter, project, workflow } = createAdapter({
      selection: ['w1'],
      editorMode: 'staging',
    }, { nodes: [wdNode], defaultPose: {} });
    adapter._dragState = { type: 'warp', wdNodeId: 'w1', ptIndex: 0, isAnimMode: false };
    adapter.animationRef.current.draftPose = new Map([['w1', {
      mesh_verts: [{ x: 10, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 100 }],
    }]]);

    onCanvasPointerUp(adapter);
    expect(project.defaultPose?.w1?.mesh_verts?.[0]).toEqual({ x: 10, y: 0 });
    expect(workflow.at(-1)).toEqual({ type: 'COMMIT_GESTURE' });
  });

  it('commits warp drag via animation authoring in animation mode', () => {
    const wdNode = {
      id: 'w1', type: 'warpDeformer',
      col: 1, row: 1, gridX: 0, gridY: 0, gridW: 100, gridH: 100,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
      visible: true, opacity: 1,
    };
    const commitGesture = vi.fn(() => ({ changed: true }));
    const { adapter, workflow } = createAdapter({
      selection: ['w1'],
      editorMode: 'animation',
      autoKeyframe: true,
    }, { nodes: [wdNode], animations: [{ id: 'anim1', duration: 1000, fps: 24, tracks: [] }] });
    adapter.animationAuthoringAdapter = { commitGesture };
    adapter._dragState = { type: 'warp', wdNodeId: 'w1', ptIndex: 0, isAnimMode: true };
    adapter.animationRef.current.activeAnimationId = 'anim1';
    adapter.animationRef.current.draftPose = new Map([['w1', {
      mesh_verts: [{ x: 10, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 100 }],
    }]]);

    onCanvasPointerUp(adapter);
    expect(commitGesture).toHaveBeenCalledWith({ source: 'auto-key' });
    expect(workflow.at(-1)).toEqual({ type: 'COMMIT_GESTURE' });
  });

  it('cancels warp drag and restores project snapshot', () => {
    const wdNode = {
      id: 'w1', type: 'warpDeformer',
      col: 1, row: 1, gridX: 0, gridY: 0, gridW: 100, gridH: 100,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
      visible: true, opacity: 1,
    };
    const { adapter, project, workflow } = createAdapter({
      selection: ['w1'],
      editorMode: 'staging',
    }, { nodes: [wdNode], defaultPose: {} });
    project.defaultPose = { w1: { mesh_verts: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 100 }] } };
    adapter._projectSnapshot = structuredClone(project);
    adapter._dragState = { type: 'warp', wdNodeId: 'w1', ptIndex: 0, isAnimMode: false };
    adapter.animationRef.current.draftPose = new Map([['w1', {
      mesh_verts: [{ x: 10, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 100 }],
    }]]);

    cancelCanvasGesture(adapter);
    expect(workflow.at(-1)).toEqual({ type: 'CANCEL_GESTURE' });
    expect(adapter._dragState).toBeNull();
    expect(project.defaultPose.w1.mesh_verts[0]).toEqual({ x: 0, y: 0 });
  });

  it('weight paint add mode increases selected bone weight through gesture', () => {
    const node = {
      id: 'part-1', type: 'part',
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
      mesh: {
        vertices: [
          { x: 10, y: 10, restX: 10, restY: 10 },
          { x: 80, y: 80, restX: 80, restY: 80 },
          { x: 90, y: 10, restX: 90, restY: 10 },
        ],
        uvs: [0.1, 0.1, 0.8, 0.8, 0.9, 0.1],
        triangles: [[0, 1, 2]],
        edgeIndices: new Set([0, 1, 2]),
        influences: [
          [{ boneId: 'bone-1', weight: 0.1 }, { boneId: 'bone-2', weight: 0.9 }],
          [{ boneId: 'bone-2', weight: 1 }],
          [{ boneId: 'bone-2', weight: 1 }],
        ],
      },
    };
    const { adapter } = createAdapter({
      activeTool: 'weightPaint', selection: ['part-1'],
      weightPaintMode: true, weightPaintBoneId: 'bone-1',
      weightPaintBrushMode: 'add', weightPaintStrength: 0.5,
      brushSize: 30, brushHardness: 1,
    }, { nodes: [node], bones: [{ id: 'bone-1' }, { id: 'bone-2' }] });

    onCanvasPointerDown(adapter, { button: 0, world: { x: 10, y: 10 } });
    const w = node.mesh.influences[0].find(inf => inf.boneId === 'bone-1').weight;
    const originalNormalized = 0.1 / (0.1 + 0.9);
    expect(w).toBeGreaterThan(originalNormalized);
  });

  it('weight paint subtract mode decreases selected bone weight through gesture', () => {
    const node = {
      id: 'part-1', type: 'part',
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
      mesh: {
        vertices: [
          { x: 10, y: 10, restX: 10, restY: 10 },
          { x: 80, y: 80, restX: 80, restY: 80 },
          { x: 90, y: 10, restX: 90, restY: 10 },
        ],
        uvs: [0.1, 0.1, 0.8, 0.8, 0.9, 0.1],
        triangles: [[0, 1, 2]],
        edgeIndices: new Set([0, 1, 2]),
        influences: [
          [{ boneId: 'bone-1', weight: 0.6 }, { boneId: 'bone-2', weight: 0.4 }],
          [{ boneId: 'bone-2', weight: 1 }],
          [{ boneId: 'bone-2', weight: 1 }],
        ],
      },
    };
    const { adapter } = createAdapter({
      activeTool: 'weightPaint', selection: ['part-1'],
      weightPaintMode: true, weightPaintBoneId: 'bone-1',
      weightPaintBrushMode: 'subtract', weightPaintStrength: 0.5,
      brushSize: 30, brushHardness: 1,
    }, { nodes: [node], bones: [{ id: 'bone-1' }, { id: 'bone-2' }] });

    onCanvasPointerDown(adapter, { button: 0, world: { x: 10, y: 10 } });
    const w = node.mesh.influences[0].find(inf => inf.boneId === 'bone-1')?.weight ?? 0;
    const originalNormalized = 0.6 / (0.6 + 0.4);
    expect(w).toBeLessThan(originalNormalized);
  });

  it('weight paint replace mode drives weight toward target through gesture', () => {
    const node = {
      id: 'part-1', type: 'part',
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
      mesh: {
        vertices: [
          { x: 10, y: 10, restX: 10, restY: 10 },
          { x: 80, y: 80, restX: 80, restY: 80 },
          { x: 90, y: 10, restX: 90, restY: 10 },
        ],
        uvs: [0.1, 0.1, 0.8, 0.8, 0.9, 0.1],
        triangles: [[0, 1, 2]],
        edgeIndices: new Set([0, 1, 2]),
        influences: [
          [{ boneId: 'bone-1', weight: 0.6 }, { boneId: 'bone-2', weight: 0.4 }],
          [{ boneId: 'bone-2', weight: 1 }],
          [{ boneId: 'bone-2', weight: 1 }],
        ],
      },
    };
    const { adapter } = createAdapter({
      activeTool: 'weightPaint', selection: ['part-1'],
      weightPaintMode: true, weightPaintBoneId: 'bone-1',
      weightPaintBrushMode: 'replace', weightPaintTargetValue: 0.25,
      weightPaintStrength: 0.5, brushSize: 30, brushHardness: 1,
    }, { nodes: [node], bones: [{ id: 'bone-1' }, { id: 'bone-2' }] });

    onCanvasPointerDown(adapter, { button: 0, world: { x: 10, y: 10 } });
    const w = node.mesh.influences[0].find(inf => inf.boneId === 'bone-1').weight;
    expect(w).toBeGreaterThan(0.25);
    expect(w).toBeLessThan(0.6);
    const sum = node.mesh.influences[0].reduce((acc, inf) => acc + inf.weight, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it('weight paint smooth mode averages neighboring weights through gesture', () => {
    const node = {
      id: 'part-1', type: 'part',
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
      mesh: {
        vertices: [
          { x: 10, y: 10, restX: 10, restY: 10 },
          { x: 20, y: 10, restX: 20, restY: 10 },
          { x: 10, y: 20, restX: 10, restY: 20 },
        ],
        uvs: [0.1, 0.1, 0.2, 0.1, 0.1, 0.2],
        triangles: [[0, 1, 2]],
        edgeIndices: new Set([0, 1, 2]),
        influences: [
          [{ boneId: 'bone-1', weight: 0.8 }, { boneId: 'bone-2', weight: 0.2 }],
          [{ boneId: 'bone-1', weight: 0.1 }, { boneId: 'bone-2', weight: 0.9 }],
          [{ boneId: 'bone-1', weight: 0.5 }, { boneId: 'bone-2', weight: 0.5 }],
        ],
      },
    };
    const { adapter } = createAdapter({
      activeTool: 'weightPaint', selection: ['part-1'],
      weightPaintMode: true, weightPaintBoneId: 'bone-1',
      weightPaintBrushMode: 'smooth', weightPaintStrength: 1,
      brushSize: 40, brushHardness: 1,
    }, { nodes: [node], bones: [{ id: 'bone-1' }, { id: 'bone-2' }] });

    onCanvasPointerDown(adapter, { button: 0, world: { x: 10, y: 10 } });
    const w = node.mesh.influences[0].find(inf => inf.boneId === 'bone-1').weight;
    const originalNormalized = 0.8 / (0.8 + 0.2);
    expect(w).toBeLessThan(originalNormalized);
    expect(w).toBeGreaterThan(0.2);
    const sum = node.mesh.influences[0].reduce((acc, inf) => acc + inf.weight, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it('weight paint produces one undo batch per stroke', () => {
    const node = {
      id: 'part-1', type: 'part',
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
      mesh: {
        vertices: [
          { x: 10, y: 10, restX: 10, restY: 10 },
          { x: 80, y: 80, restX: 80, restY: 80 },
          { x: 90, y: 10, restX: 90, restY: 10 },
        ],
        uvs: [0.1, 0.1, 0.8, 0.8, 0.9, 0.1],
        triangles: [[0, 1, 2]],
        edgeIndices: new Set([0, 1, 2]),
      },
    };
    const { adapter, commands } = createAdapter({
      activeTool: 'weightPaint', selection: ['part-1'],
      weightPaintMode: true, weightPaintBoneId: 'bone-1',
      weightPaintStrength: 1, brushSize: 30, brushHardness: 1,
    }, { nodes: [node], bones: [{ id: 'bone-1' }] });

    onCanvasPointerDown(adapter, { button: 0, world: { x: 10, y: 10 } });
    onCanvasPointerMove(adapter, { world: { x: 20, y: 20 } });
    onCanvasPointerUp(adapter);

    const batchStarts = commands.filter(c => c.type === 'beginBatch' && c.payload?.meta?.type === 'weightPaint');
    expect(batchStarts).toHaveLength(1);
  });
});
