import { describe, expect, it } from 'vitest';
import { computeEvaluatedExportBounds } from '@/features/export/domain/computeEvaluatedExportBounds';

function makePart(id, { w, h, transform = {}, visible } = {}) {
  return {
    id,
    type: 'part',
    name: id,
    imageWidth: w ?? 100,
    imageHeight: h ?? 50,
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0, ...transform },
    ...(visible !== undefined ? { visible } : {}),
    mesh: {
      vertices: [
        { x: 0, y: 0 },
        { x: (w ?? 100), y: 0 },
        { x: (w ?? 100), y: (h ?? 50) },
        { x: 0, y: (h ?? 50) },
      ],
      uvs: [0, 0, 1, 0, 1, 1, 0, 1],
      triangles: [0, 1, 2, 0, 2, 3],
    },
  };
}

function makeGroup(id, { transform = {} } = {}) {
  return {
    id,
    type: 'group',
    name: id,
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0, ...transform },
  };
}

function makeProject(parts, opts = {}) {
  return {
    version: 9,
    canvas: { width: 800, height: 600, x: 0, y: 0, bgEnabled: false, bgColor: '#ffffff' },
    textures: [],
    nodes: parts,
    bones: [],
    animations: [
      { id: 'anim-1', name: 'idle', duration: 2000, fps: 30, tracks: [] },
    ],
    ...opts,
  };
}

describe('computeEvaluatedExportBounds', () => {
  it('returns no-visible-content for empty project', () => {
    const result = computeEvaluatedExportBounds({
      project: { version: 9, canvas: { width: 800, height: 600, x: 0, y: 0 }, nodes: [], animations: [], textures: [], bones: [], slots: [], attachments: [], skins: [], constraints: [], defaultPose: {}, physics_groups: [], physicsRules: [], libraryFolders: [], assetPlacements: [], controlHandles: [], animationModifiers: [] },
      frameSpecs: [{ animationId: 'anim-1', timeMs: 0 }],
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('no-visible-content');
  });

  it('returns no-visible-content for empty frameSpecs', () => {
    const result = computeEvaluatedExportBounds({
      project: makeProject([makePart('part-1')]),
      frameSpecs: [],
    });
    expect(result.ok).toBe(false);
  });

  it('computes bounds for a single part at rest pose', () => {
    const result = computeEvaluatedExportBounds({
      project: makeProject([makePart('part-1', { x: 0, y: 0, w: 100, h: 50 })]),
      frameSpecs: [{ animationId: 'anim-1', timeMs: 0 }],
      padding: 0,
    });
    expect(result.ok).toBe(true);
    expect(result.area.x).toBe(0);
    expect(result.area.y).toBe(0);
    expect(result.area.width).toBe(100);
    expect(result.area.height).toBe(50);
  });

  it('includes padding in bounds', () => {
    const result = computeEvaluatedExportBounds({
      project: makeProject([makePart('part-1', { x: 0, y: 0, w: 100, h: 50 })]),
      frameSpecs: [{ animationId: 'anim-1', timeMs: 0 }],
      padding: 20,
    });
    expect(result.ok).toBe(true);
    expect(result.area.x).toBe(-20);
    expect(result.area.y).toBe(-20);
    expect(result.area.width).toBe(140);
    expect(result.area.height).toBe(90);
  });

  it('handles negative coordinates', () => {
    const result = computeEvaluatedExportBounds({
      project: makeProject([makePart('part-1', { transform: { x: -50, y: -30 } })]),
      frameSpecs: [{ animationId: 'anim-1', timeMs: 0 }],
      padding: 0,
    });
    expect(result.ok).toBe(true);
    expect(result.area.x).toBe(-50);
    expect(result.area.y).toBe(-30);
  });

  it('handles invisible parts', () => {
    const result = computeEvaluatedExportBounds({
      project: makeProject([
        makePart('visible-part', { x: 0, y: 0, w: 50, h: 50 }),
        makePart('invisible-part', { x: 0, y: 0, w: 500, h: 500, visible: false }),
      ]),
      frameSpecs: [{ animationId: 'anim-1', timeMs: 0 }],
      padding: 0,
    });
    expect(result.ok).toBe(true);
    expect(result.area.width).toBe(50);
    expect(result.area.height).toBe(50);
  });

  it('handles parent transforms (group hierarchy)', () => {
    const group = makeGroup('group-1', { transform: { x: 100, y: 50 } });
    const part = makePart('part-1', { transform: { x: 10, y: 20 }, w: 20, h: 10 });
    part.parent = 'group-1';
    const result = computeEvaluatedExportBounds({
      project: makeProject([group, part]),
      frameSpecs: [{ animationId: 'anim-1', timeMs: 0 }],
      padding: 0,
    });
    expect(result.ok).toBe(true);
    expect(result.area.x).toBe(110);
    expect(result.area.y).toBe(70);
    expect(result.area.width).toBe(20);
    expect(result.area.height).toBe(10);
  });

  it('unions bounds across multiple frame times', () => {
    const project = makeProject([
      makePart('part-1', { transform: { x: 0, y: 0 }, w: 100, h: 100 }),
    ]);
    const result = computeEvaluatedExportBounds({
      project,
      frameSpecs: [
        { animationId: 'anim-1', timeMs: 0 },
        { animationId: 'anim-1', timeMs: 500 },
      ],
      padding: 0,
    });
    expect(result.ok).toBe(true);
    expect(result.area.x).toBe(0);
    expect(result.area.y).toBe(0);
    expect(result.area.width).toBe(100);
    expect(result.area.height).toBe(100);
  });
});
