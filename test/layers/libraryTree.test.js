import { describe, it, expect } from 'vitest';
import { buildLibraryTree, flattenLibraryTree } from '@/features/layers/domain/buildLibraryTree.js';

function makeTexture(id, fileName, fileSize = 1024) {
  return { id, source: `data:${fileName}`, fileName, fileSize };
}

function makeNode(id, name) {
  return { id, type: 'part', name, parent: null, draw_order: 0, visible: true };
}

function makeFolder(id, name, parentId = null, sourceFileName = undefined, origin = undefined) {
  const folder = { id, name, parentId };
  if (sourceFileName !== undefined) folder.sourceFileName = sourceFileName;
  if (origin !== undefined) folder.origin = origin;
  return folder;
}

function makePlacement(assetId, folderId = null) {
  return { assetId, folderId };
}

describe('buildLibraryTree', () => {
  it('returns empty array for empty project', () => {
    const result = buildLibraryTree({ libraryFolders: [], assetPlacements: [], textures: [], nodes: [] });
    expect(result).toEqual([]);
  });

  it('shows loose assets at root level', () => {
    const textures = [makeTexture('t1', 'head.png'), makeTexture('t2', 'body.png')];
    const nodes = [makeNode('t1', 'Head'), makeNode('t2', 'Body')];
    const result = buildLibraryTree({ libraryFolders: [], assetPlacements: [], textures, nodes });

    expect(result).toHaveLength(2);
    expect(result[0].kind).toBe('asset');
    expect(result[0].id).toBe('t1');
    expect(result[0].name).toBe('Head');
    expect(result[0].sourceFileName).toBe('head.png');
    expect(result[1].kind).toBe('asset');
    expect(result[1].name).toBe('Body');
  });

  it('uses node.name as primary, texture.fileName as secondary', () => {
    const textures = [makeTexture('t1', 'imported_file.png')];
    const nodes = [makeNode('t1', 'My Custom Name')];
    const result = buildLibraryTree({ libraryFolders: [], assetPlacements: [], textures, nodes });

    expect(result[0].name).toBe('My Custom Name');
    expect(result[0].sourceFileName).toBe('imported_file.png');
  });

  it('marks assets used by a canvas part sharing their textureId', () => {
    const textures = [makeTexture('t1', 'shared.png')];
    const nodes = [
      makeNode('t1', 'Source'),
      { ...makeNode('copy', 'Copy'), textureId: 't1' },
    ];

    const result = buildLibraryTree({ libraryFolders: [], assetPlacements: [], textures, nodes });

    expect(result[0].isInUse).toBe(true);
  });

  it('falls back to fileName when node missing', () => {
    const textures = [makeTexture('t1', 'orphan.png')];
    const result = buildLibraryTree({ libraryFolders: [], assetPlacements: [], textures, nodes: [] });

    expect(result[0].name).toBe('orphan');
    expect(result[0].sourceFileName).toBe('orphan.png');
  });

  it('falls back to texture id when both missing', () => {
    const textures = [{ id: 't1', source: 'data:x', fileSize: 100 }];
    const result = buildLibraryTree({ libraryFolders: [], assetPlacements: [], textures, nodes: [] });

    expect(result[0].name).toBe('t1');
  });

  it('shows assets inside PSD folders', () => {
    const folders = [makeFolder('f1', 'Character', null, 'character.psd', 'import')];
    const textures = [makeTexture('t1', 'layer1.png'), makeTexture('t2', 'layer2.png')];
    const nodes = [makeNode('t1', 'Layer 1'), makeNode('t2', 'Layer 2')];
    const placements = [makePlacement('t1', 'f1'), makePlacement('t2', 'f1')];

    const result = buildLibraryTree({ libraryFolders: folders, assetPlacements: placements, textures, nodes });

    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('folder');
    expect(result[0].name).toBe('Character');
    expect(result[0].sourceFileName).toBe('character.psd');
    expect(result[0].origin).toBe('import');
    expect(result[0].children).toHaveLength(2);
    expect(result[0].children[0].kind).toBe('asset');
    expect(result[0].children[0].name).toBe('Layer 1');
  });

  it('user-created folders have no sourceFileName', () => {
    const folders = [makeFolder('f1', 'My Folder', null, undefined, 'user')];
    const result = buildLibraryTree({ libraryFolders: folders, assetPlacements: [], textures: [], nodes: [] });

    expect(result[0].kind).toBe('folder');
    expect(result[0].name).toBe('My Folder');
    expect(result[0].sourceFileName).toBeNull();
    expect(result[0].origin).toBe('user');
  });

  it('supports nested folders', () => {
    const folders = [
      makeFolder('f1', 'Root Folder', null),
      makeFolder('f2', 'Sub Folder', 'f1'),
    ];
    const result = buildLibraryTree({ libraryFolders: folders, assetPlacements: [], textures: [], nodes: [] });

    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('folder');
    expect(result[0].children).toHaveLength(1);
    expect(result[0].children[0].kind).toBe('folder');
    expect(result[0].children[0].name).toBe('Sub Folder');
  });

  it('mixed folders and loose assets', () => {
    const folders = [makeFolder('f1', 'PSD Import', null, 'art.psd', 'import')];
    const textures = [makeTexture('t1', 'layer.png'), makeTexture('t2', 'extra.png')];
    const nodes = [makeNode('t1', 'Layer'), makeNode('t2', 'Extra')];
    const placements = [makePlacement('t1', 'f1')];

    const result = buildLibraryTree({ libraryFolders: folders, assetPlacements: placements, textures, nodes });

    expect(result).toHaveLength(2);
    expect(result[0].kind).toBe('folder');
    expect(result[0].children).toHaveLength(1);
    expect(result[1].kind).toBe('asset');
    expect(result[1].name).toBe('Extra');
  });

  it('skips assets with no matching texture', () => {
    const placements = [makePlacement('nonexistent', null)];
    const result = buildLibraryTree({ libraryFolders: [], assetPlacements: placements, textures: [], nodes: [] });

    expect(result).toEqual([]);
  });
});

describe('flattenLibraryTree', () => {
  it('flattens nested tree preserving order', () => {
    const tree = [
      { kind: 'folder', id: 'f1', children: [
        { kind: 'asset', id: 't1' },
        { kind: 'folder', id: 'f2', children: [
          { kind: 'asset', id: 't2' },
        ]},
      ]},
      { kind: 'asset', id: 't3' },
    ];

    const flat = flattenLibraryTree(tree);
    expect(flat.map(r => r.id)).toEqual(['f1', 't1', 'f2', 't2', 't3']);
  });

  it('handles empty array', () => {
    expect(flattenLibraryTree([])).toEqual([]);
  });
});
