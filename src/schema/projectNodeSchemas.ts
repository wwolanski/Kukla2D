import { z } from 'zod';

import {
  toAssetId,
  toBoneId,
  toNodeId,
} from '@kukla2d/contracts';

const NodeIdSchema = z.string().min(1).transform(toNodeId);
const BoneIdSchema = z.string().min(1).transform(toBoneId);
const AssetIdSchema = z.string().min(1).transform(toAssetId);

export const CanvasSchema = z.object({
  width: z.number().finite().min(1),
  height: z.number().finite().min(1),
  x: z.number().finite(),
  y: z.number().finite(),
  presetId: z.enum([
    'custom', 'square-256', 'square-512', 'square-1024', 'pixel-16-9',
    'hd-720', 'full-hd', 'portrait-720', 'classic-4-3',
  ]).optional(),
  fitSource: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('animation'),
      animationId: z.string().min(1),
      animationName: z.string(),
    }),
    z.object({ kind: z.literal('staging') }),
  ]).nullable().optional(),
});

export const TransformSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  rotation: z.number().finite(),
  scaleX: z.number().finite(),
  scaleY: z.number().finite(),
  pivotX: z.number().finite(),
  pivotY: z.number().finite(),
});

const VertexSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  restX: z.number().finite().optional(),
  restY: z.number().finite().optional(),
});

const VertexInfluenceSchema = z.object({
  boneId: BoneIdSchema,
  weight: z.number().finite().min(0).max(1),
});

const MeshSchema = z.object({
  vertices: z.array(VertexSchema),
  uvs: z.array(z.number().finite()),
  triangles: z.array(z.tuple([z.number().int(), z.number().int(), z.number().int()])),
  edgeIndices: z.array(z.number().int()),
  boneWeights: z.array(z.number().finite()).optional(),
  jointBoneId: BoneIdSchema.nullable().optional(),
  influences: z.array(z.array(VertexInfluenceSchema)).optional(),
}).superRefine((mesh, ctx) => {
  const vertexCount = mesh.vertices.length;
  if (mesh.uvs.length !== vertexCount * 2) {
    ctx.addIssue({
      code: 'custom',
      message: `UV count ${mesh.uvs.length} must equal vertices.length * 2 (${vertexCount * 2})`,
      path: ['uvs'],
    });
  }
  for (let i = 0; i < mesh.triangles.length; i++) {
    const triangle = mesh.triangles[i];
    if (!triangle) continue;
    for (let j = 0; j < 3; j++) {
      const index = triangle[j];
      if (index === undefined) continue;
      if (index < 0 || index >= vertexCount) {
        ctx.addIssue({
          code: 'custom',
          message: `Triangle index ${index} out of range [0, ${vertexCount})`,
          path: ['triangles', i],
        });
      }
    }
  }
  if (mesh.boneWeights && mesh.boneWeights.length !== vertexCount) {
    ctx.addIssue({
      code: 'custom',
      message: `boneWeights length ${mesh.boneWeights.length} must equal vertices.length ${vertexCount}`,
      path: ['boneWeights'],
    });
  }
  if (mesh.influences && mesh.influences.length !== vertexCount) {
    ctx.addIssue({
      code: 'custom',
      message: `influences length ${mesh.influences.length} must equal vertices.length ${vertexCount}`,
      path: ['influences'],
    });
  }
});

const BlendShapeSchema = z.object({
  id: NodeIdSchema,
  name: z.string(),
  deltas: z.array(z.object({ dx: z.number().finite(), dy: z.number().finite() })),
});

const AlphaContourPointSchema = z.union([
  z.tuple([z.number().finite(), z.number().finite()]),
  z.object({ x: z.number().finite(), y: z.number().finite() }).transform(({ x, y }) => [x, y]),
]);

const BaseNodeFields = {
  id: z.string().min(1),
  name: z.string(),
  parent: NodeIdSchema.nullable(),
  opacity: z.number().finite().min(0).max(1),
  visible: z.boolean(),
  transform: TransformSchema,
  pivotLocked: z.boolean().optional(),
};

const PartNodeSchema = z.object({
  ...BaseNodeFields,
  type: z.literal('part'),
  draw_order: z.number(),
  clip_mask: z.string().nullable().optional(),
  clipToPartId: NodeIdSchema.optional(),
  meshOpts: z.unknown().nullable().optional(),
  mesh: MeshSchema.nullable().optional(),
  blendShapes: z.array(BlendShapeSchema).optional(),
  blendShapeValues: z.record(z.string(), z.number()).optional(),
  boneId: BoneIdSchema.nullable().optional(),
  meshInfluenceBoneIds: z.array(BoneIdSchema).optional(),
  boneLinkLocked: z.boolean().optional(),
  imageWidth: z.number().optional(),
  imageHeight: z.number().optional(),
  imageBounds: z.object({
    minX: z.number(), minY: z.number(), maxX: z.number(), maxY: z.number(),
  }).optional(),
  alphaContours: z.array(z.array(AlphaContourPointSchema)).optional(),
  textureId: AssetIdSchema.optional(),
  tag: z.string().optional(),
}).superRefine((node, ctx) => {
  if (!node.mesh || !node.blendShapes) return;
  const vertexCount = node.mesh.vertices.length;
  node.blendShapes.forEach((shape, index) => {
    if (shape.deltas.length !== vertexCount) {
      ctx.addIssue({
        code: 'custom',
        message: `blendShape "${shape.id}" deltas length ${shape.deltas.length} must equal vertices.length ${vertexCount}`,
        path: ['blendShapes', index, 'deltas'],
      });
    }
  });
});

const GroupNodeSchema = z.object({
  ...BaseNodeFields,
  type: z.literal('group'),
  boneRole: z.string().nullable().optional(),
});

const WarpDeformerNodeSchema = z.object({
  ...BaseNodeFields,
  type: z.literal('warpDeformer'),
  col: z.number().optional(),
  row: z.number().optional(),
  gridX: z.number().optional(),
  gridY: z.number().optional(),
  gridW: z.number().optional(),
  gridH: z.number().optional(),
});

export const NodeSchema = z.discriminatedUnion('type', [
  PartNodeSchema,
  GroupNodeSchema,
  WarpDeformerNodeSchema,
]);
