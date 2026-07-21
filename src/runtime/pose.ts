import type { Bone, BoneId, Node, NodeId, ProjectDocument, Vertex } from '@kukla2d/contracts';

import { isFiniteNumber } from '@/lib/math';

import { computeBoneWorldMatrices, computeInverseBindMatrices } from './skeleton.js';
import { linearBlendSkinning } from './skin.js';

import type { Matrix3 } from '../domain/transforms.js';


export interface BoneTransformOverride {
  x?: number;
  y?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
}

export type PoseOverrideMap = ReadonlyMap<string, Readonly<Record<string, unknown>>>;

interface SkinnedMesh {
  nodeId: NodeId;
  /** Runtime owns this mutable output buffer. */
  vertices: Float32Array;
}

export interface EvaluatedPose {
  skinnedMeshes: readonly SkinnedMesh[];
  /** Runtime owns matrices; consumers must treat them as readonly. */
  boneMatrices: ReadonlyMap<BoneId, Matrix3>;
}

export interface PoseProject {
  bones: readonly Bone[];
  nodes: readonly Node[];
  defaultPose?: ProjectDocument['defaultPose'];
}

export function evaluatePose(
  project: PoseProject,
  animationOverrides?: PoseOverrideMap | null,
): EvaluatedPose {
  const effectiveBones = project.bones.map(bone => applyBonePose(
    bone,
    project.defaultPose?.[bone.id],
    animationOverrides?.get(bone.id),
  ));
  const boneWorldMatrices = computeBoneWorldMatrices(effectiveBones);
  const inverseBindMatrices = computeInverseBindMatrices(computeBoneWorldMatrices(project.bones));
  const skinnedMeshes: SkinnedMesh[] = [];

  for (const node of project.nodes) {
    if (node.type !== 'part' || !node.mesh?.influences) continue;
    const baseVertices = flattenVertices(node.mesh.vertices);
    skinnedMeshes.push({
      nodeId: node.id,
      vertices: linearBlendSkinning(
        baseVertices,
        node.mesh.influences,
        boneWorldMatrices,
        inverseBindMatrices,
      ),
    });
  }

  return { skinnedMeshes, boneMatrices: boneWorldMatrices };
}

function applyBonePose(
  bone: Bone,
  defaults: Readonly<Record<string, unknown>> | undefined,
  override: Readonly<Record<string, unknown>> | undefined,
): Bone {
  if (!defaults && !override) return bone;
  const base = {
    ...bone.setup,
    ...finiteTransformValues(defaults),
  };
  const values = finiteTransformValues(override);
  return {
    ...bone,
    setup: {
      ...base,
      x: base.x + (values.x ?? 0),
      y: base.y + (values.y ?? 0),
      rotation: base.rotation + (values.rotation ?? 0),
      scaleX: base.scaleX * (values.scaleX ?? 1),
      scaleY: base.scaleY * (values.scaleY ?? 1),
    },
  };
}

function finiteTransformValues(value: Readonly<Record<string, unknown>> | undefined): BoneTransformOverride {
  if (!value) return {};
  return {
    ...(isFiniteNumber(value.x) ? { x: value.x } : {}),
    ...(isFiniteNumber(value.y) ? { y: value.y } : {}),
    ...(isFiniteNumber(value.rotation) ? { rotation: value.rotation } : {}),
    ...(isFiniteNumber(value.scaleX) ? { scaleX: value.scaleX } : {}),
    ...(isFiniteNumber(value.scaleY) ? { scaleY: value.scaleY } : {}),
  };
}


function flattenVertices(vertices: readonly Vertex[]): Float32Array {
  const result = new Float32Array(vertices.length * 2);
  vertices.forEach((vertex, index) => {
    result[index * 2] = vertex.x;
    result[index * 2 + 1] = vertex.y;
  });
  return result;
}
