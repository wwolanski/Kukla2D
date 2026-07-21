import type { Node, Texture } from '@kukla2d/contracts';

export function findNodePreviewTexture(
  node: Node | null | undefined,
  nodes: readonly Node[],
  textureMap: ReadonlyMap<string, Texture>,
): Texture | null {
  if (!node) return null;
  if (node.type === 'part') return textureMap.get(node.textureId ?? node.id) ?? null;

  const children = (nodes ?? []).filter(n => n.parent === node.id);
  const directPart = children.find(n => n.type === 'part');
  if (directPart) return textureMap.get(directPart.id) ?? null;

  for (const child of children) {
    const found = findNodePreviewTexture(child, nodes, textureMap);
    if (found) return found;
  }

  return null;
}
