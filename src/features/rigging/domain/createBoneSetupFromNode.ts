import type { BoneSetup, Node } from '@kukla2d/contracts';

export function createBoneSetupFromNode(node: Pick<Node, 'transform'> | null | undefined): BoneSetup {
  const t = node?.transform;
  return {
    x: t?.pivotX ?? t?.x ?? 0,
    y: t?.pivotY ?? t?.y ?? 0,
    rotation: t?.rotation ?? 0,
    scaleX: t?.scaleX ?? 1,
    scaleY: t?.scaleY ?? 1,
    shearX: 0,
    shearY: 0,
    length: Math.max(20, Math.hypot(t?.x ?? 0, t?.y ?? 0) || 80),
  };
}
