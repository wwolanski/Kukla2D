/**
 * Legacy skinning path.
 *
 * DEPRECATED: legacy `mesh.jointBoneId` / `mesh.boneWeights` skinning path.
 * Per plan §4A.1 bones/slots/attachments should use canonical `influences[]`.
 * This path is kept so existing arm/leg rigging UX continues to work until
 * a generic weight-paint UI is added in a later stage. Migration
 * 1-to-2 still converts these to `influences` on project load.
 *
 * Owner: refaktor canvas (Etap 4).
 */
import type { Mesh, Vertex } from '@kukla2d/contracts';

interface LegacyRigNode {
  id: string;
  parent: string | null;
  boneRole?: string | null;
  transform: { pivotX: number; pivotY: number };
}

const LIMB_ROLE_MAP = {
  'leftArm': 'leftElbow', 'rightArm': 'rightElbow',
  'leftLeg': 'leftKnee', 'rightLeg': 'rightKnee',
} as const;
type LimbRole = keyof typeof LIMB_ROLE_MAP;

const BLEND = 40;

/**
 * Apply legacy joint weights for a part whose parent group has a known limb role.
 *
 * @param {Object} args
 * @param {Object} args.project
 * @param {Object} args.node
 * @param {Array<{x:number,y:number}>} args.vertices
 * @returns {boolean} true when legacy weights were applied
 */
export function applyLegacyJointWeights({ project, node, vertices }: {
  project: { nodes: LegacyRigNode[] };
  node: LegacyRigNode & { mesh: Mesh };
  vertices: readonly Vertex[];
}): boolean {
  const parentGroup = project.nodes.find(candidate => candidate.id === node.parent);
  if (!parentGroup || !parentGroup.boneRole || !(parentGroup.boneRole in LIMB_ROLE_MAP)) return false;
  const childRole = LIMB_ROLE_MAP[parentGroup.boneRole as LimbRole];
  if (!childRole) return false;
  const jointBone = project.nodes.find(candidate => candidate.parent === parentGroup.id && candidate.boneRole === childRole);
  if (!jointBone) return false;

  const jx = jointBone.transform.pivotX;
  const jy = jointBone.transform.pivotY;
  const sx = parentGroup.transform.pivotX;
  const sy = parentGroup.transform.pivotY;

  const axDx = jx - sx;
  const axDy = jy - sy;
  const axLen = Math.sqrt(axDx * axDx + axDy * axDy) || 1;
  const axX = axDx / axLen;
  const axY = axDy / axLen;

  node.mesh.boneWeights = vertices.map(v => {
    const proj2 = (v.x - jx) * axX + (v.y - jy) * axY;
    const w = proj2 / BLEND + 0.5;
    return Math.max(0, Math.min(1, w));
  });
  node.mesh.jointBoneId = jointBone.id;
  return true;
}

export const LEGACY_SKINNING_BLEND = BLEND;
export const LEGACY_LIMB_ROLE_MAP = LIMB_ROLE_MAP;
