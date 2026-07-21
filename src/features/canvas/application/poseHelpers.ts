type PoseMap = ReadonlyMap<string, Readonly<Record<string, unknown>>>;

export function mergePoseMaps(base: PoseMap, extra: PoseMap | null | undefined): Map<string, Record<string, unknown>> {
  if (!extra?.size) return new Map(base);
  const merged = base?.size ? new Map(base) : new Map<string, Record<string, unknown>>();
  for (const [nodeId, partial] of extra) {
    const existing = merged.get(nodeId) ?? {};
    merged.set(nodeId, { ...existing, ...partial });
  }
  return merged;
}

export function withTransientPose<T extends { draftPose: PoseMap }>(animationState: T, transientPose: PoseMap | null | undefined): T {
  if (!transientPose?.size) return animationState;
  return {
    ...animationState,
    draftPose: mergePoseMaps(animationState.draftPose, transientPose),
  };
}
