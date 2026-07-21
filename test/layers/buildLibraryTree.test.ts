import { describe, expect, it } from 'vitest';
import { buildLibraryTree, flattenLibraryTree } from '@/features/layers/domain/buildLibraryTree';
import type { LibraryTreeRow } from '@/features/layers/domain/buildLibraryTree';

const texture = (id: string, overrides = {}) => ({
  id, fileName: `${id}.png`, fileSize: 1024, ...overrides,
});

const node = (id: string, overrides = {}) => ({
  id, type: 'part', name: id, ...overrides,
});

describe('buildLibraryTree', () => {
  it('returns empty for empty input', () => {
    const rows = buildLibraryTree({ textures: [], nodes: [] });
    expect(rows).toEqual([]);
  });

  it('lists loose textures as asset rows', () => {
    const rows = buildLibraryTree({
      textures: [texture('t1')],
      nodes: [node('t1')],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('asset');
    expect(rows[0].id).toBe('t1');
    expect(rows[0].name).toBe('t1');
  });

  it('uses node name over fileName', () => {
    const rows = buildLibraryTree({
      textures: [texture('t1', { fileName: 'file.png' })],
      nodes: [node('t1', { name: 'MyPart' })],
    });
    expect(rows[0].name).toBe('MyPart');
  });

  it('builds folder hierarchy', () => {
    const rows = buildLibraryTree({
      libraryFolders: [
        { id: 'f1', name: 'Characters' },
        { id: 'f2', name: 'Hero', parentId: 'f1' },
      ],
      assetPlacements: [
        { assetId: 't1', folderId: 'f2' },
        { assetId: 't2', folderId: 'f1' },
      ],
      textures: [texture('t1'), texture('t2')],
      nodes: [node('t1'), node('t2')],
    });
    expect(rows).toHaveLength(1);
    const rootFolder = rows[0];
    expect(rootFolder.kind).toBe('folder');
    expect(rootFolder.name).toBe('Characters');
    if (rootFolder.kind === 'folder') {
      expect(rootFolder.children).toHaveLength(2);
    }
  });

  it('marks assets in use when referenced by a part node', () => {
    const rows = buildLibraryTree({
      textures: [texture('t1')],
      nodes: [node('n1', { textureId: 't1' })],
    });
    expect(rows[0].isInUse).toBe(true);
  });

  it('falls back to texture id for name', () => {
    const rows = buildLibraryTree({
      textures: [texture('t1', { fileName: null })],
      nodes: [],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('t1');
  });
});

describe('flattenLibraryTree', () => {
  it('flattens nested folders into a flat list', () => {
    const tree: LibraryTreeRow[] = [
      {
        kind: 'folder',
        id: 'f1',
        name: 'Root',
        sourceFileName: null,
        origin: null,
        children: [
          {
            kind: 'asset' as const,
            id: 'a1',
            name: 'Asset 1',
            sourceFileName: null,
            texture: texture('a1'),
            node: undefined,
            isInUse: false,
            size: null,
          },
        ],
      },
      {
        kind: 'asset' as const,
        id: 'a2',
        name: 'Asset 2',
        sourceFileName: null,
        texture: texture('a2'),
        node: undefined,
        isInUse: false,
        size: null,
      },
    ];

    const flat = flattenLibraryTree(tree);
    expect(flat).toHaveLength(3);
    expect(flat[0].kind).toBe('folder');
    expect(flat[1].kind).toBe('asset');
    expect(flat[2].kind).toBe('asset');
  });
});
