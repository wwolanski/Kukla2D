// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { buildSkeletonFrame } from '@/features/canvas/domain/skeletonFrame.js';
import { computeWorldMatrices } from '@/domain/transforms';

function makeBoneNode(id, boneRole, transform, opts = {}) {
  return {
    id,
    type: 'group',
    boneRole,
    parent: opts.parent ?? null,
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0, ...transform },
    visible: true,
    draw_order: 0,
  };
}

describe('buildSkeletonFrame', () => {
  it('returns empty frame when no bones', () => {
    const frame = buildSkeletonFrame({
      effectiveNodes: [],
      effectiveBones: [],
      worldMatrices: new Map(),
    });
    expect(frame.boneNodes).toEqual({});
    expect(frame.boneLines).toHaveLength(0);
    expect(frame.connections).toHaveLength(0);
    expect(frame.joints).toHaveLength(0);
  });

  it('maps bone nodes by role', () => {
    const torso = makeBoneNode('t1', 'torso', { x: 50, y: 50 });
    const head = makeBoneNode('h1', 'head', { x: 50, y: 0 });
    const nodes = [torso, head];
    const wm = computeWorldMatrices(nodes);
    const frame = buildSkeletonFrame({
      effectiveNodes: nodes,
      effectiveBones: [
        { id: 't1', name: 'Torso', parentId: null, setup: { x: 50, y: 50 } },
        { id: 'h1', name: 'Head', parentId: 't1', setup: { x: 50, y: 0 } },
      ],
      worldMatrices: wm,
    });
    expect(frame.boneNodes.torso).toBe(torso);
    expect(frame.boneNodes.head).toBe(head);
  });

  it('computes bone lines from effectiveBones', () => {
    const frame = buildSkeletonFrame({
      effectiveNodes: [],
      effectiveBones: [
        { id: 'b1', name: 'Bone1', parentId: null, setup: { x: 10, y: 20 } },
        { id: 'b2', name: 'Bone2', parentId: 'b1', setup: { x: 30, y: 40 } },
      ],
      worldMatrices: new Map(),
    });
    expect(frame.boneLines).toHaveLength(2);
    expect(frame.boneLines[0].x1).toBe(10);
    expect(frame.boneLines[0].y1).toBe(20);
    expect(frame.boneLines[0].x2).toBe(90);
    expect(frame.boneLines[0].y2).toBe(20);
    expect(frame.boneLines[1].x1).toBe(30);
    expect(frame.boneLines[1].y1).toBe(40);
    expect(frame.boneLines[1].x2).toBe(110);
    expect(frame.boneLines[1].y2).toBe(40);
  });

  it('computes connections between bone nodes', () => {
    const torso = makeBoneNode('t1', 'torso', { pivotX: 0, pivotY: 0 });
    const neck = makeBoneNode('n1', 'neck', { pivotX: 0, pivotY: -50 });
    const nodes = [torso, neck];
    const wm = computeWorldMatrices(nodes);
    const frame = buildSkeletonFrame({
      effectiveNodes: nodes,
      effectiveBones: [],
      worldMatrices: wm,
    });
    expect(frame.connections).toHaveLength(1);
    expect(frame.connections[0].fromRole).toBe('torso');
    expect(frame.connections[0].toRole).toBe('neck');
  });

  it('computes joints from effectiveBones', () => {
    const frame = buildSkeletonFrame({
      effectiveNodes: [],
      effectiveBones: [
        { id: 'b1', name: 'Bone1', parentId: null, setup: { x: 10, y: 20 } },
      ],
      worldMatrices: new Map(),
    });
    expect(frame.joints).toHaveLength(1);
    expect(frame.joints[0].x).toBe(10);
    expect(frame.joints[0].y).toBe(20);
    expect(frame.joints[0].boneId).toBe('b1');
  });

  it('marks inactive bones with isSelected=false and isMultiSelected=false', () => {
    const frame = buildSkeletonFrame({
      effectiveNodes: [],
      effectiveBones: [
        { id: 'b1', parentId: null, setup: { x: 0, y: 0 } },
        { id: 'b2', parentId: 'b1', setup: { x: 0, y: 0 } },
      ],
      worldMatrices: new Map(),
      editorState: { activeBoneId: null, selection: [], hoverHit: null },
    });
    expect(frame.boneLines[0].isActive).toBe(false);
    expect(frame.boneLines[0].isSelected).toBe(false);
    expect(frame.boneLines[0].isMultiSelected).toBe(false);
    expect(frame.joints[0].isActive).toBe(false);
    expect(frame.joints[0].isSelected).toBe(false);
    expect(frame.joints[0].isMultiSelected).toBe(false);
  });

  it('renders weight paint target as hovered without selecting the bone', () => {
    const frame = buildSkeletonFrame({
      effectiveNodes: [],
      effectiveBones: [
        { id: 'b1', parentId: null, setup: { x: 0, y: 0 } },
        { id: 'b2', parentId: 'b1', setup: { x: 0, y: 0 } },
      ],
      worldMatrices: new Map(),
      editorState: {
        activeBoneId: null,
        selection: ['mesh-1'],
        hoverHit: null,
        weightPaintBoneId: 'b2',
      },
    });

    expect(frame.boneLines[1]).toMatchObject({
      isHovered: true,
      isSelected: false,
      isActive: false,
    });
    expect(frame.joints[1].isHovered).toBe(true);
  });

  it('marks single selected bone with isSelected=true and isMultiSelected=false', () => {
    const frame = buildSkeletonFrame({
      effectiveNodes: [],
      effectiveBones: [
        { id: 'b1', parentId: null, setup: { x: 0, y: 0 } },
        { id: 'b2', parentId: 'b1', setup: { x: 0, y: 0 } },
      ],
      worldMatrices: new Map(),
      editorState: { activeBoneId: 'b2', selection: ['b2'], hoverHit: null },
    });
    expect(frame.boneLines[0].isSelected).toBe(false);
    expect(frame.boneLines[0].isMultiSelected).toBe(false);
    expect(frame.boneLines[1].isSelected).toBe(true);
    expect(frame.boneLines[1].isMultiSelected).toBe(false);
    expect(frame.boneLines[1].isActive).toBe(true);
  });

  it('marks multi-selected bones with isMultiSelected=true', () => {
    const frame = buildSkeletonFrame({
      effectiveNodes: [],
      effectiveBones: [
        { id: 'b1', parentId: null, setup: { x: 0, y: 0 } },
        { id: 'b2', parentId: 'b1', setup: { x: 0, y: 0 } },
        { id: 'b3', parentId: 'b2', setup: { x: 0, y: 0 } },
      ],
      worldMatrices: new Map(),
      editorState: { activeBoneId: 'b2', selection: ['b1', 'b2', 'b3'], hoverHit: null },
    });
    for (const line of frame.boneLines) {
      expect(line.isSelected).toBe(true);
      expect(line.isMultiSelected).toBe(true);
    }
    expect(frame.joints[1].isMultiSelected).toBe(true);
  });

  it('keeps panel-hovered bone visible independently of selection', () => {
    const frame = buildSkeletonFrame({
      effectiveNodes: [],
      effectiveBones: [
        { id: 'b1', parentId: null, setup: { x: 0, y: 0 } },
        { id: 'b2', parentId: 'b1', setup: { x: 0, y: 0 } },
      ],
      worldMatrices: new Map(),
      editorState: {
        activeBoneId: 'b2',
        selection: ['b2'],
        hoverHit: 'bone:b1',
        hoverSource: 'panel',
      },
    });
    expect(frame.boneLines[0].isHovered).toBe(true);
    expect(frame.boneLines[0].isSelected).toBe(false);
    expect(frame.boneLines[0].isActive).toBe(false);
    expect(frame.boneLines[1].isHovered).toBe(false);
    expect(frame.boneLines[1].isSelected).toBe(true);
  });

  it('suppresses canvas-hovered bone while another element is active', () => {
    const frame = buildSkeletonFrame({
      effectiveNodes: [],
      effectiveBones: [
        { id: 'b1', parentId: null, setup: { x: 0, y: 0 } },
        { id: 'b2', parentId: 'b1', setup: { x: 0, y: 0 } },
      ],
      worldMatrices: new Map(),
      editorState: {
        activeBoneId: 'b2',
        selection: ['b2'],
        hoverHit: 'bone:b1',
        hoverSource: 'canvas',
      },
    });

    expect(frame.boneLines[0].isHovered).toBe(false);
  });

  it('maps a hovered IK constraint to its assigned bone', () => {
    const frame = buildSkeletonFrame({
      effectiveNodes: [],
      effectiveBones: [
        { id: 'b1', parentId: null, setup: { x: 0, y: 0 } },
        { id: 'b2', parentId: 'b1', setup: { x: 0, y: 0 } },
      ],
      constraints: [{ id: 'ik-1', assignedBoneId: 'b2', affectedBoneIds: ['b2'] }],
      worldMatrices: new Map(),
      editorState: { selection: [], hoverHit: 'constraint:ik-1' },
    });

    expect(frame.boneLines.find(line => line.boneId === 'b2').isHovered).toBe(true);
    expect(frame.boneLines.find(line => line.boneId === 'b1').isHovered).toBe(false);
  });

  it('hides active parent bone while drawing its child preview', () => {
    const frame = buildSkeletonFrame({
      effectiveNodes: [],
      effectiveBones: [
        { id: 'b1', parentId: null, setup: { x: 0, y: 0, rotation: 0, length: 100 } },
        { id: 'b2', parentId: null, setup: { x: 0, y: 50, rotation: 0, length: 100 } },
      ],
      worldMatrices: new Map(),
      editorState: {
        activeBoneId: 'b1',
        selection: ['b1'],
        hoverHit: null,
        activeTool: 'drawBone',
        drawBonePreview: { startX: 0, startY: 0, endX: 50, endY: 50 },
      },
    });

    expect(frame.boneLines.map(line => line.boneId)).toEqual(['b2']);
    expect(frame.joints.map(joint => joint.boneId)).toEqual(['b2']);
  });

  it('builds a boneTransformFrame for the active bone with start/end/rotate/length handles', () => {
    const frame = buildSkeletonFrame({
      effectiveNodes: [],
      effectiveBones: [
        { id: 'b1', parentId: null, setup: { x: 0, y: 0, rotation: 0, length: 100 } },
        { id: 'b2', parentId: 'b1', setup: { x: 100, y: 0, rotation: 0, length: 80 } },
      ],
      worldMatrices: new Map(),
      editorState: {
        activeBoneId: 'b1',
        selection: ['b1'],
        hoverHit: null,
        activeTool: 'transform',
        selectionTarget: 'rig',
        riggingTool: 'select',
      },
    });
    expect(frame.boneTransformFrame).not.toBeNull();
    expect(frame.boneTransformFrame.boneId).toBe('b1');
    expect(frame.boneTransformFrame.start).toEqual({ x: 0, y: 0 });
    expect(frame.boneTransformFrame.end).toEqual({ x: 100, y: 0 });
    expect(frame.boneTransformFrame.lengthHandle).toEqual({ x: 100, y: 0 });
    expect(frame.boneTransformFrame.rotateHandle.x).toBe(0);
    expect(frame.boneTransformFrame.rotateHandle.y).toBeGreaterThan(0);
  });

  it('skips boneTransformFrame when there is no selection or active bone', () => {
    const frame = buildSkeletonFrame({
      effectiveNodes: [],
      effectiveBones: [
        { id: 'b1', parentId: null, setup: { x: 0, y: 0 } },
      ],
      worldMatrices: new Map(),
      editorState: { activeBoneId: null, selection: [], hoverHit: null },
    });
    expect(frame.boneTransformFrame).toBeNull();
  });

  it('builds extendable endpoint handle only in pose tool', () => {
    const frame = buildSkeletonFrame({
      effectiveNodes: [],
      effectiveBones: [
        { id: 'b1', parentId: null, setup: { x: 10, y: 20, rotation: 0, length: 50 } },
      ],
      worldMatrices: new Map(),
      editorState: {
        activeBoneId: 'b1',
        selection: ['b1'],
        activeTool: 'pose',
        selectionTarget: 'rig',
      },
      poseHandleExtensions: new Map([['b1', 250]]),
    });

    expect(frame.boneTransformFrame).toBeNull();
    expect(frame.poseHandleFrame.radius).toBe(250);
    expect(frame.poseHandleFrame.handle).toEqual({ x: 260, y: 20 });
    expect(frame.poseHandleFrame.boneTip).toEqual({ x: 60, y: 20 });
  });

  it('shows pose handle for hovered bone before selection', () => {
    const frame = buildSkeletonFrame({
      effectiveNodes: [],
      effectiveBones: [
        { id: 'selected', setup: { x: 0, y: 0, rotation: 0, length: 20 } },
        { id: 'hovered', setup: { x: 100, y: 50, rotation: 90, length: 40 } },
      ],
      worldMatrices: new Map(),
      editorState: {
        activeBoneId: 'selected',
        selection: ['selected'],
        hoverHit: 'bone:hovered',
        hoverSource: 'panel',
        activeTool: 'pose',
        selectionTarget: 'rig',
      },
    });

    expect(frame.poseHandleFrame.boneId).toBe('hovered');
    expect(frame.poseHandleFrame.handle.x).toBeCloseTo(100);
    expect(frame.poseHandleFrame.handle.y).toBeCloseTo(90);
  });
});
