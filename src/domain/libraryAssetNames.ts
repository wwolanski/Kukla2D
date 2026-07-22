import type { Node, Texture } from '@kukla2d/contracts';

function fileStem(fileName: string | null | undefined): string {
  return (fileName ?? '').replace(/\.[^.]+$/, '').trim();
}

export function createUniqueName(requestedName: string, existingNames: Iterable<string>): string {
  const base = requestedName.trim() || 'Untitled';
  const occupied = new Set([...existingNames].map(name => name.trim().toLocaleLowerCase()));
  if (!occupied.has(base.toLocaleLowerCase())) return base;

  let suffix = 1;
  while (occupied.has(`${base} (${suffix})`.toLocaleLowerCase())) suffix += 1;
  return `${base} (${suffix})`;
}

export function buildUniqueTextureNameMap(
  textures: readonly Texture[],
  nodes: readonly Node[],
): Map<string, string> {
  const nodeMap = new Map<string, Node>(nodes.map(node => [node.id, node]));
  const names = new Map<string, string>();
  const occupied: string[] = [];

  for (const texture of textures) {
    const node = nodeMap.get(texture.id);
    const preferred = texture.name?.trim()
      || node?.name?.trim()
      || fileStem(texture.fileName)
      || texture.id;
    const unique = createUniqueName(preferred, occupied);
    names.set(texture.id, unique);
    occupied.push(unique);
  }
  return names;
}
