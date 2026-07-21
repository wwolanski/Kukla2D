import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '@/store/projectStore';
import { clearHistory } from '@/store/undoHistory';

/**
 * Characterization tests for plan 17, stage 01 (canonical v5 animation document).
 * Guards regressions where node mutation actions read legacy `track.nodeId`
 * instead of canonical `track.targetId`:
 *   - duplicateNode must clone tracks onto the duplicated node id
 *   - deleteNode must orphan tracks whose targetId points at a removed node
 */

function seedProject(parts = []) {
  const project = {
    version: 5,
    canvas: { width: 800, height: 600, x: 0, y: 0, bgEnabled: false, bgColor: '#ffffff' },
    textures: [],
    nodes: parts.map((p) => ({
      id: p.id,
      type: 'part',
      name: p.name ?? p.id,
      parent: p.parent ?? null,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
      draw_order: p.draw_order ?? 0,
      opacity: 1,
      visible: true,
    })),
    bones: [],
    slots: [],
    attachments: [],
    skins: [],
    constraints: [],
    defaultPose: {},
    animations: Array.from(
      parts
        .flatMap((p) => (p.tracks ?? []).map((t) => ({
          animationId: t.animationId ?? 'anim-1',
          targetId: t.targetId ?? p.id,
          property: t.property ?? 'x',
          keyframes: t.keyframes ?? [{ time: 0, value: 0 }],
        })))
        .reduce((acc, t) => {
          let anim = acc.get(t.animationId);
          if (!anim) {
            anim = {
              id: t.animationId,
              name: t.animationId,
              duration: 2000,
              fps: 24,
              tracks: [],
              audioTracks: [],
            };
            acc.set(t.animationId, anim);
          }
          anim.tracks.push({
            targetId: t.targetId,
            property: t.property,
            keyframes: t.keyframes,
          });
          return acc;
        }, new Map())
        .values(),
    ),
    physics_groups: [],
    physicsRules: [],
  };
  return project;
}

function resetStore(project) {
  clearHistory();
  useProjectStore.setState({
    project,
    versionControl: { geometryVersion: 0, transformVersion: 0, textureVersion: 0 },
    hasUnsavedChanges: false,
  });
}

describe('plan17 stage01 canonical track binding (duplicateNode/deleteNode)', () => {
  beforeEach(() => {
    clearHistory();
    useProjectStore.setState({
      project: {
        version: 5,
        canvas: { width: 800, height: 600, x: 0, y: 0, bgEnabled: false, bgColor: '#ffffff' },
        textures: [],
        nodes: [],
        bones: [],
        slots: [],
        attachments: [],
        skins: [],
        constraints: [],
        defaultPose: {},
        animations: [],
        physics_groups: [],
        physicsRules: [],
      },
      versionControl: { geometryVersion: 0, transformVersion: 0, textureVersion: 0 },
      hasUnsavedChanges: false,
    });
  });

  it('duplicateNode clones canonical targetId tracks onto the new node id', () => {
    resetStore(seedProject([
      { id: 'p1', draw_order: 0, tracks: [{ animationId: 'anim-1', keyframes: [{ time: 100, value: 7 }] }] },
    ]));

    useProjectStore.getState().duplicateNode('p1');

    const { project } = useProjectStore.getState();
    expect(project.nodes.map((n) => n.id)).toEqual(['p1', expect.any(String)]);
    const newId = project.nodes.find((n) => n.id !== 'p1').id;

    const anim = project.animations.find((a) => a.id === 'anim-1');
    const targetIds = anim.tracks.map((t) => t.targetId);
    expect(targetIds).toContain('p1');
    expect(targetIds).toContain(newId);
    expect(anim.tracks.every((t) => t.nodeId === undefined)).toBe(true);

    const clonedTrack = anim.tracks.find((t) => t.targetId === newId);
    expect(clonedTrack.keyframes).toEqual([{ time: 100, value: 7 }]);
  });

  it('deleteNode removes canonical targetId tracks for the deleted node', () => {
    resetStore(seedProject([
      { id: 'p1', draw_order: 0, tracks: [{ animationId: 'anim-1' }] },
      { id: 'p2', draw_order: 1, tracks: [{ animationId: 'anim-1' }] },
    ]));

    useProjectStore.getState().deleteNode('p1');

    const { project } = useProjectStore.getState();
    expect(project.nodes.map((n) => n.id)).toEqual(['p2']);

    const anim = project.animations.find((a) => a.id === 'anim-1');
    const targetIds = anim.tracks.map((t) => t.targetId);
    expect(targetIds).toEqual(['p2']);
    expect(anim.tracks.find((t) => t.targetId === 'p1')).toBeUndefined();
  });
});