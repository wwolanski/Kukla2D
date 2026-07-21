import { describe, it, expect } from 'vitest';
import { migrateProject } from '../src/schema/migrateProject';
import { CURRENT_PROJECT_VERSION } from '../src/schema/projectSchema';

function makePart(id: string, name: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    type: 'part',
    name,
    parent: null,
    draw_order: 0,
    opacity: 1,
    visible: true,
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
    ...extra,
  };
}

describe('migrateProject', () => {
  it('migrates version "0.1" to current schema version', () => {
    const old = {
      version: '0.1',
      canvas: { width: 800, height: 600 },
      textures: [],
      nodes: [],
      animations: [],
    };
    const migrated = migrateProject(old);
    expect(migrated.version).toBe(CURRENT_PROJECT_VERSION);
  });

  it('migrates v4 tracks from nodeId to targetId', () => {
    const migrated = migrateProject({
      version: 4,
      canvas: { width: 800, height: 600, x: 0, y: 0, bgEnabled: false, bgColor: '#ffffff' },
      textures: [],
      nodes: [],
      animations: [{
        id: 'a1',
        name: 'Test',
        duration: 1000,
        fps: 24,
        tracks: [
          { nodeId: 'n1', property: 'x', keyframes: [] },
        ],
      }],
    });

    expect(migrated.version).toBe(CURRENT_PROJECT_VERSION);
    expect((migrated.animations as unknown[])[0]).toBeDefined();
    const anim = (migrated.animations as Record<string, unknown>[])[0]!;
    const tracks = anim.tracks as Record<string, unknown>[];
    expect(tracks[0]!.targetId).toBe('n1');
    expect(tracks[0]).not.toHaveProperty('nodeId');
  });

  it('adds missing arrays', () => {
    const old = { version: '0.1' };
    const migrated = migrateProject(old);
    expect(Array.isArray(migrated.textures)).toBe(true);
    expect(Array.isArray(migrated.nodes)).toBe(true);
    expect(Array.isArray(migrated.animations)).toBe(true);
    expect(migrated).not.toHaveProperty('parameters');
    expect(Array.isArray(migrated.physics_groups)).toBe(true);
    expect(Array.isArray(migrated.physicsRules)).toBe(true);
  });

  it('adds canvas defaults', () => {
    const old = { version: '0.1' };
    const migrated = migrateProject(old);
    const canvas = migrated.canvas as Record<string, unknown>;
    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(600);
    expect(canvas).not.toHaveProperty('bgEnabled');
    expect(canvas).not.toHaveProperty('bgColor');
  });

  it('adds blendShapes defaults to nodes', () => {
    const old = {
      version: '0.1',
      nodes: [{ id: 'n1', type: 'part', name: 'Test' }],
    };
    const migrated = migrateProject(old);
    const nodes = migrated.nodes as Record<string, unknown>[];
    expect((nodes[0] as Record<string, unknown>).blendShapes).toEqual([]);
    expect((nodes[0] as Record<string, unknown>).blendShapeValues).toEqual({});
  });

  it('adds warpDeformer grid defaults', () => {
    const old = {
      version: '0.1',
      nodes: [{ id: 'w1', type: 'warpDeformer', name: 'Warp' }],
    };
    const migrated = migrateProject(old);
    const nodes = migrated.nodes as Record<string, unknown>[];
    expect((nodes[0] as Record<string, unknown>).col).toBe(2);
    expect((nodes[0] as Record<string, unknown>).row).toBe(2);
    expect((nodes[0] as Record<string, unknown>).gridW).toBe(200);
  });

  it('filters puppet_pins tracks', () => {
    const old = {
      version: '0.1',
      animations: [{
        id: 'a1', name: 'Test', duration: 1000, fps: 24,
        tracks: [
          { nodeId: 'n1', property: 'x', keyframes: [] },
          { nodeId: 'n1', property: 'puppet_pins', keyframes: [] },
        ],
      }],
    };
    const migrated = migrateProject(old);
    const anims = migrated.animations as Record<string, unknown>[];
    const tracks = anims[0]!.tracks as Record<string, unknown>[];
    expect(tracks).toHaveLength(1);
    expect(tracks[0]!.property).toBe('x');
    expect(tracks[0]!.targetId).toBe('n1');
  });

  it('throws on unknown version', () => {
    const old = { version: '999' };
    expect(() => migrateProject(old)).toThrow('No migration found');
  });

  it('maps unique center iris and eyewhite pair during v3 -> v4 migration', () => {
    const migrated = migrateProject({
      version: 3,
      canvas: { width: 800, height: 600, x: 0, y: 0, bgEnabled: false, bgColor: '#ffffff' },
      textures: [],
      nodes: [
        makePart('white-center', 'eyewhite'),
        makePart('iris-center', 'irides', { draw_order: 1 }),
      ],
      animations: [],
    });

    expect(migrated.version).toBe(CURRENT_PROJECT_VERSION);
    const nodes = migrated.nodes as Record<string, unknown>[];
    const irisCenter = nodes.find((node) => node.id === 'iris-center');
    expect(irisCenter).toBeDefined();
    expect(irisCenter!.clipToPartId).toBe('white-center');
  });

  it('maps unique left and right pairs independently', () => {
    const migrated = migrateProject({
      version: 3,
      canvas: { width: 800, height: 600, x: 0, y: 0, bgEnabled: false, bgColor: '#ffffff' },
      textures: [],
      nodes: [
        makePart('white-l', 'eyewhite-l'),
        makePart('iris-l', 'irides-l'),
        makePart('white-r', 'eyewhite-r'),
        makePart('iris-r', 'irides-r'),
      ],
      animations: [],
    });

    const nodes = migrated.nodes as Record<string, unknown>[];
    const irisL = nodes.find((node) => node.id === 'iris-l');
    const irisR = nodes.find((node) => node.id === 'iris-r');
    expect(irisL).toBeDefined();
    expect(irisR).toBeDefined();
    expect(irisL!.clipToPartId).toBe('white-l');
    expect(irisR!.clipToPartId).toBe('white-r');
  });

  it('does not map ambiguous pairs or overwrite explicit clipToPartId', () => {
    const migrated = migrateProject({
      version: 3,
      canvas: { width: 800, height: 600, x: 0, y: 0, bgEnabled: false, bgColor: '#ffffff' },
      textures: [],
      nodes: [
        makePart('white-a', 'eyewhite-l'),
        makePart('white-b', 'eyewhite-l 2'),
        makePart('iris-a', 'irides-l'),
        makePart('iris-explicit', 'irides-r', { clipToPartId: 'manual-target' }),
        makePart('white-r', 'eyewhite-r'),
      ],
      animations: [],
    });

    const nodes = migrated.nodes as Record<string, unknown>[];
    const irisA = nodes.find((node) => node.id === 'iris-a');
    const irisExplicit = nodes.find((node) => node.id === 'iris-explicit');
    expect(irisA).toBeDefined();
    expect(irisExplicit).toBeDefined();
    expect(irisA!.clipToPartId).toBeUndefined();
    expect(irisExplicit!.clipToPartId).toBe('manual-target');
  });

  it('throws when v4 track nodeId and targetId conflict', () => {
    expect(() => migrateProject({
      version: 4,
      canvas: { width: 800, height: 600, x: 0, y: 0, bgEnabled: false, bgColor: '#ffffff' },
      textures: [],
      nodes: [],
      animations: [{
        id: 'a1',
        name: 'Test',
        duration: 1000,
        fps: 24,
        tracks: [
          { nodeId: 'n1', targetId: 'n2', property: 'x', keyframes: [] },
        ],
      }],
    })).toThrow(/Migration 4->5 conflict/);
  });

  it('preserves duration 0 through migration', () => {
    const migrated = migrateProject({
      version: 4,
      canvas: { width: 800, height: 600, x: 0, y: 0, bgEnabled: false, bgColor: '#ffffff' },
      textures: [],
      nodes: [],
      animations: [{
        id: 'a1',
        name: 'Zero Duration',
        duration: 0,
        fps: 24,
        tracks: [],
      }],
    });
    const anims = migrated.animations as Record<string, unknown>[];
    expect(anims[0]!.duration).toBe(0);
  });

  it('migrates v5 to v6 with libraryFolders and assetPlacements', () => {
    const migrated = migrateProject({
      version: 5,
      canvas: { width: 800, height: 600, x: 0, y: 0, bgEnabled: false, bgColor: '#ffffff' },
      textures: [],
      nodes: [],
      animations: [],
    });
    expect(migrated.version).toBe(CURRENT_PROJECT_VERSION);
    expect(migrated.libraryFolders).toEqual([]);
    expect(migrated.assetPlacements).toEqual([]);
  });

  it('preserves existing libraryFolders through v5->v6 migration', () => {
    const migrated = migrateProject({
      version: 5,
      canvas: { width: 800, height: 600, x: 0, y: 0, bgEnabled: false, bgColor: '#ffffff' },
      textures: [],
      nodes: [],
      animations: [],
      libraryFolders: [{ id: 'f1', name: 'Test', origin: 'import' }],
      assetPlacements: [{ assetId: 'a1', folderId: 'f1' }],
    });
    expect(migrated.version).toBe(CURRENT_PROJECT_VERSION);
    const folders = migrated.libraryFolders as unknown[];
    expect(folders).toHaveLength(1);
    const placements = migrated.assetPlacements as unknown[];
    expect(placements).toHaveLength(1);
  });

  it('migrates v6 to v7 with controlHandles and animationModifiers', () => {
    const migrated = migrateProject({
      version: 6,
      canvas: { width: 800, height: 600, x: 0, y: 0, bgEnabled: false, bgColor: '#ffffff' },
      textures: [],
      nodes: [],
      animations: [],
    });
    expect(migrated.version).toBe(CURRENT_PROJECT_VERSION);
    const handles = migrated.controlHandles as unknown[];
    expect(handles).toEqual([]);
    const modifiers = migrated.animationModifiers as unknown[];
    expect(modifiers).toEqual([]);
  });

  it('migrates v7 to v8 with version bump only', () => {
    const migrated = migrateProject({
      version: 7,
      canvas: { width: 800, height: 600, x: 0, y: 0, bgEnabled: false, bgColor: '#ffffff' },
      textures: [],
      nodes: [],
      animations: [],
      controlHandles: [],
      animationModifiers: [],
    });
    expect(migrated.version).toBe(CURRENT_PROJECT_VERSION);
  });

  it('preserves existing controlHandles through v6->v7 migration', () => {
    const migrated = migrateProject({
      version: 6,
      canvas: { width: 800, height: 600, x: 0, y: 0, bgEnabled: false, bgColor: '#ffffff' },
      textures: [],
      nodes: [],
      animations: [],
      controlHandles: [{
        id: 'ch1', name: 'Chest', role: 'chest',
        space: 'node-local',
        target: { kind: 'part', id: 'body' },
        position: { x: 100, y: 50 },
      }],
    });
    expect(migrated.version).toBe(CURRENT_PROJECT_VERSION);
    const handles = migrated.controlHandles as unknown[];
    expect(handles).toHaveLength(1);
    expect((handles[0] as Record<string, unknown>).id).toBe('ch1');
  });
});
