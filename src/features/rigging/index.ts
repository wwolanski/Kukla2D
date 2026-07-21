export { createBoneSetupFromNode } from './domain/createBoneSetupFromNode.js';
export {
  assignNodeToBone,
  clearNodeBoneAssignment,
  assignProjectNodeToBone,
  clearProjectNodeBoneAssignment,
  isNodeAssignedToBone,
  isNodeDirectlyAssignedToBone,
  doesBoneInfluenceNode,
  getNodeMeshInfluenceBoneIds,
  setNodeMeshInfluenceBone,
  assignOrAddProjectNodeBoneInfluence,
  isBoneLinkLocked,
  setBoneLinkLocked,
  getAssignedBoneForNode,
  getLinkedNodesForBone,
  isLinkedNodeAssignedToBone,
} from './domain/boneAssignment.js';
export {
  translateLinkedBoneGroup,
  translateLinkedBoneSelection,
  translateLinkedNodeGroup,
  rotateLinkedNodeGroup,
  scaleLinkedNodeGroup,
  rotateLinkedBone,
  rotateLinkedBoneSelection,
  setBoneLength,
  scaleBoneSelectionLengths,
  applyLinkedTranslation,
} from './domain/linkedTransform.js';
export { BONE_TOOL_DEFAULTS } from './domain/boneToolDefaults.js';
