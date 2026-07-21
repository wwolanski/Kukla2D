import type { VertexInfluence } from '@kukla2d/contracts';

export function normalizeInfluences(
  influences: readonly (readonly VertexInfluence[])[],
): VertexInfluence[][] {
  return influences.map(vertexInfluences => {
    const positive = vertexInfluences.filter(inf => inf.weight > 0);
    const sum = positive.reduce((acc, inf) => acc + inf.weight, 0);
    if (sum <= 0) return [];
    return positive
      .map(inf => ({ boneId: inf.boneId, weight: inf.weight / sum }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 4);
  });
}
