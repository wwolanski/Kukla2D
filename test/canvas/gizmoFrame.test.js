// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { buildGizmoFrame } from '@/features/canvas/domain/gizmoFrame.js';
import { computeWorldMatrices } from '@/domain/transforms';

function makeNode(id, type, transform, opts = {}) {
  return {
    id,
    type,
    parent: opts.parent ?? null,
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0, ...transform },
    mesh: opts.mesh ?? null,
    imageBounds: opts.imageBounds ?? null,
    visible: opts.visible ?? true,
    draw_order: opts.draw_order ?? 0,
    ...opts.extra,
  };
}

describe('buildGizmoFrame', () => {
  it('returns invisible frame when no selectedNode', () => {
    const nodes = [makeNode('p1', 'part', { x: 10, y: 20 })];
    const wm = computeWorldMatrices(nodes);
    const frame = buildGizmoFrame({ selectedNode: null, effectiveNodes: nodes, worldMatrices: wm });
    expect(frame.visible).toBe(false);
  });

  it('returns invisible frame for warpDeformer', () => {
    const wd = makeNode('w1', 'warpDeformer', { x: 0, y: 0 });
    const nodes = [wd];
    const wm = computeWorldMatrices(nodes);
    const frame = buildGizmoFrame({ selectedNode: wd, effectiveNodes: nodes, worldMatrices: wm });
    expect(frame.visible).toBe(false);
  });

  it('computes pivot from node transform', () => {
    const part = makeNode('p1', 'part', { x: 10, y: 20, pivotX: 5, pivotY: 5 });
    const nodes = [part];
    const wm = computeWorldMatrices(nodes);
    const frame = buildGizmoFrame({ selectedNode: part, effectiveNodes: nodes, worldMatrices: wm });
    expect(frame.visible).toBe(true);
    expect(frame.pivot.x).toBeCloseTo(15);
    expect(frame.pivot.y).toBeCloseTo(25);
  });

  it('computes bbox from mesh vertices', () => {
    const part = makeNode('p1', 'part', { x: 0, y: 0 }, {
      mesh: { vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 80 }, { x: 0, y: 80 }] },
    });
    const nodes = [part];
    const wm = computeWorldMatrices(nodes);
    const frame = buildGizmoFrame({ selectedNode: part, effectiveNodes: nodes, worldMatrices: wm });
    expect(frame.bboxPoints).toHaveLength(4);
    expect(frame.bboxPoints[0].x).toBeCloseTo(0);
    expect(frame.bboxPoints[0].y).toBeCloseTo(0);
    expect(frame.bboxPoints[2].x).toBeCloseTo(100);
    expect(frame.bboxPoints[2].y).toBeCloseTo(80);
  });

  it('computes bbox from imageBounds fallback', () => {
    const part = makeNode('p1', 'part', { x: 0, y: 0 }, {
      imageBounds: { minX: 10, minY: 20, maxX: 110, maxY: 120 },
    });
    const nodes = [part];
    const wm = computeWorldMatrices(nodes);
    const frame = buildGizmoFrame({ selectedNode: part, effectiveNodes: nodes, worldMatrices: wm });
    expect(frame.bboxPoints).toHaveLength(4);
    expect(frame.bboxPoints[0].x).toBeCloseTo(10);
    expect(frame.bboxPoints[0].y).toBeCloseTo(20);
  });

  it('center is midpoint of bbox', () => {
    const part = makeNode('p1', 'part', { x: 0, y: 0 }, {
      imageBounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
    });
    const nodes = [part];
    const wm = computeWorldMatrices(nodes);
    const frame = buildGizmoFrame({ selectedNode: part, effectiveNodes: nodes, worldMatrices: wm });
    expect(frame.center.x).toBeCloseTo(50);
    expect(frame.center.y).toBeCloseTo(50);
  });

  it('rotation handle is offset from topCenter', () => {
    const part = makeNode('p1', 'part', { x: 0, y: 0, pivotX: 50, pivotY: 50 }, {
      imageBounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
    });
    const nodes = [part];
    const wm = computeWorldMatrices(nodes);
    const frame = buildGizmoFrame({ selectedNode: part, effectiveNodes: nodes, worldMatrices: wm });
    expect(frame.rotationHandle.y).not.toBe(frame.topCenter.y);
  });
});
