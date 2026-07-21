import { describe, it, expect } from 'vitest';
import { resolveLinkedNodeAuthoredTransform } from '@/features/canvas/domain/linkedNodeAuthoring.js';
import {
  applyBoneLinkedNodeOverrides,
  poseRecordToMap,
} from '@/features/canvas/domain/poseModel.js';
import { buildEffectiveNodes } from '@/features/canvas/domain/framePose.js';
import { applyBoneConstraintOverrides } from '@/features/canvas/domain/constraintPose.js';
import {
  computeWorldMatrices,
} from '@/domain/transforms';

function roundTrip({ project, posedBoneOverrides = {} }) {
  const effectiveBones = project.bones.map(bone => {
    const ov = posedBoneOverrides[bone.id];
    if (!ov) return bone;
    const setup = { ...(bone.setup ?? {}) };
    for (const k of ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'length']) {
      if (ov[k] !== undefined) setup[k] = ov[k];
    }
    return { ...bone, setup };
  });
  const preLinkedNodes = buildEffectiveNodes(project, poseRecordToMap({}));
  const preLinkedWorldMatrices = computeWorldMatrices(preLinkedNodes);
  const withBones = applyBoneConstraintOverrides(project, poseRecordToMap({}));
  const withLinked = applyBoneLinkedNodeOverrides(project, withBones);
  const displayedNodes = buildEffectiveNodes(project, withLinked);

  const results = [];
  for (const node of project.nodes) {
    if (node.type !== 'part' || node.boneLinkLocked === false) continue;
    const boneId = node.boneId ?? node.mesh?.jointBoneId
      ?? (node.mesh?.influences ?? []).flatMap(v => v.map(i => i?.boneId)).find(Boolean);
    if (!boneId) continue;
    const bone = effectiveBones.find(b => b.id === boneId);
    if (!bone) continue;

    const displayedWorld = computeWorldMatrices(displayedNodes).get(node.id);
    if (!displayedWorld) continue;

    const resolved = resolveLinkedNodeAuthoredTransform({
      node,
      bone,
      boneOverrides: bone,
      preLinkedWorldMatrices,
      desiredDisplayedWorld: displayedWorld,
    });
    results.push({ nodeId: node.id, resolved });
  }
  return results;
}

function expectMatrixClose(a, b) {
  for (let i = 0; i < 9; i++) {
    expect(a[i]).toBeCloseTo(b[i], 2);
  }
}

describe('resolveLinkedNodeAuthoredTransform', () => {
  it('returns invalid for missing node/bone', () => {
    const r = resolveLinkedNodeAuthoredTransform({ node: null, bone: null, preLinkedWorldMatrices: new Map(), desiredDisplayedWorld: new Float32Array(9) });
    expect(r.valid).toBe(false);
  });

  it('round-trips translation with bone rotation 90°', () => {
    const project = {
      nodes: [{
        id: 'img', type: 'part', boneId: 'bone1',
        transform: { x: 10, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
        visible: true, opacity: 1,
      }],
      bones: [{ id: 'bone1', parentId: null, setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, length: 10 } }],
      bonesById: null,
    };
    const results = roundTrip({ project, posedBoneOverrides: { bone1: { rotation: 90 } } });
    expect(results).toHaveLength(1);
    expect(results[0].resolved.valid).toBe(true);
    expect(results[0].resolved.transform.x).toBeCloseTo(10, 2);
    expect(results[0].resolved.transform.y).toBeCloseTo(0, 2);
    expect(results[0].resolved.transform.rotation).toBeCloseTo(0, 2);
  });

  it('round-trips translation with bone at offset', () => {
    const project = {
      nodes: [{
        id: 'img', type: 'part', boneId: 'bone1',
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
        visible: true, opacity: 1,
      }],
      bones: [{ id: 'bone1', parentId: null, setup: { x: 100, y: 0, rotation: 0, scaleX: 1, scaleY: 1, length: 10 } }],
    };
    const results = roundTrip({ project, posedBoneOverrides: { bone1: { rotation: 45 } } });
    expect(results).toHaveLength(1);
    expect(results[0].resolved.valid).toBe(true);
    expect(results[0].resolved.transform.x).toBeCloseTo(0, 2);
    expect(results[0].resolved.transform.y).toBeCloseTo(0, 2);
  });

  it('round-trips non-uniform scale', () => {
    const project = {
      nodes: [{
        id: 'img', type: 'part', boneId: 'bone1',
        transform: { x: 5, y: 5, rotation: 30, scaleX: 2, scaleY: 0.5, pivotX: 0, pivotY: 0 },
        visible: true, opacity: 1,
      }],
      bones: [{ id: 'bone1', parentId: null, setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, length: 10 } }],
    };
    const results = roundTrip({ project, posedBoneOverrides: { bone1: { scaleX: 1.5, scaleY: 0.8 } } });
    expect(results).toHaveLength(1);
    expect(results[0].resolved.valid).toBe(true);
    expect(results[0].resolved.transform.x).toBeCloseTo(5, 2);
    expect(results[0].resolved.transform.y).toBeCloseTo(5, 2);
    expect(results[0].resolved.transform.rotation).toBeCloseTo(30, 2);
    expect(results[0].resolved.transform.scaleX).toBeCloseTo(2, 2);
    expect(results[0].resolved.transform.scaleY).toBeCloseTo(0.5, 2);
  });

  it('round-trips parented node', () => {
    const project = {
      nodes: [
        {
          id: 'parent', type: 'part',
          transform: { x: 50, y: 50, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
          visible: true, opacity: 1,
        },
        {
          id: 'child', type: 'part', boneId: 'bone1', parent: 'parent',
          transform: { x: 10, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
          visible: true, opacity: 1,
        },
      ],
      bones: [{ id: 'bone1', parentId: null, setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, length: 10 } }],
    };
    const results = roundTrip({ project, posedBoneOverrides: { bone1: { rotation: 90 } } });
    expect(results).toHaveLength(1);
    expect(results[0].resolved.valid).toBe(true);
    expect(results[0].resolved.transform.x).toBeCloseTo(10, 2);
    expect(results[0].resolved.transform.y).toBeCloseTo(0, 2);
  });

  it('round-trips posed bone with both rotation and scale', () => {
    const project = {
      nodes: [{
        id: 'img', type: 'part', boneId: 'bone1',
        transform: { x: 20, y: 10, rotation: 45, scaleX: 1.5, scaleY: 0.7, pivotX: 0, pivotY: 0 },
        visible: true, opacity: 1,
      }],
      bones: [{ id: 'bone1', parentId: null, setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, length: 10 } }],
    };
    const results = roundTrip({ project, posedBoneOverrides: { bone1: { rotation: 30, scaleX: 1.2, scaleY: 0.9 } } });
    expect(results).toHaveLength(1);
    expect(results[0].resolved.valid).toBe(true);
    expect(results[0].resolved.transform.x).toBeCloseTo(20, 2);
    expect(results[0].resolved.transform.y).toBeCloseTo(10, 2);
    expect(results[0].resolved.transform.rotation).toBeCloseTo(45, 2);
    expect(results[0].resolved.transform.scaleX).toBeCloseTo(1.5, 2);
    expect(results[0].resolved.transform.scaleY).toBeCloseTo(0.7, 2);
  });

  it('full round-trip: resolve → store → re-evaluate → same displayed position', () => {
    const project = {
      nodes: [{
        id: 'img', type: 'part', boneId: 'bone1',
        transform: { x: 10, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
        visible: true, opacity: 1,
      }],
      bones: [{ id: 'bone1', parentId: null, setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, length: 10 } }],
    };
    const posedBoneOverrides = { bone1: { rotation: 90 } };
    const effectiveBones = project.bones.map(bone => {
      const ov = posedBoneOverrides[bone.id];
      if (!ov) return bone;
      const setup = { ...(bone.setup ?? {}) };
      for (const k of ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'length']) {
        if (ov[k] !== undefined) setup[k] = ov[k];
      }
      return { ...bone, setup };
    });
    const preLinkedNodes = buildEffectiveNodes(project, poseRecordToMap({}));
    const preLinkedWorldMatrices = computeWorldMatrices(preLinkedNodes);

    const displayedWorldBefore = computeWorldMatrices(
      buildEffectiveNodes(project, applyBoneLinkedNodeOverrides(project, applyBoneConstraintOverrides(project, poseRecordToMap({})))),
    ).get('img');

    const resolved = resolveLinkedNodeAuthoredTransform({
      node: project.nodes[0],
      bone: effectiveBones[0],
      boneOverrides: effectiveBones[0],
      preLinkedWorldMatrices,
      desiredDisplayedWorld: displayedWorldBefore,
    });
    expect(resolved.valid).toBe(true);

    const projectCopy = JSON.parse(JSON.stringify(project));
    projectCopy.nodes[0].transform.x = resolved.transform.x;
    projectCopy.nodes[0].transform.y = resolved.transform.y;
    projectCopy.nodes[0].transform.rotation = resolved.transform.rotation;
    projectCopy.nodes[0].transform.scaleX = resolved.transform.scaleX;
    projectCopy.nodes[0].transform.scaleY = resolved.transform.scaleY;

    const reevalOverrides = poseRecordToMap({});
    const reevalWithBones = applyBoneConstraintOverrides(projectCopy, reevalOverrides);
    const reevalWithLinked = applyBoneLinkedNodeOverrides(projectCopy, reevalWithBones);
    const reevalNodes = buildEffectiveNodes(projectCopy, reevalWithLinked);
    const displayedWorldAfter = computeWorldMatrices(reevalNodes).get('img');

    expectMatrixClose(displayedWorldBefore, displayedWorldAfter);
  });
});
