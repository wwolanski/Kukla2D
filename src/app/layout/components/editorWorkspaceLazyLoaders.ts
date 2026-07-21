export async function loadTimelinePanel(): Promise<{ default: React.ComponentType<unknown> }> {
  const module = await import('@/features/timeline');
  return { default: module.TimelinePanel };
}

export async function loadAnimationListPanel(): Promise<{ default: React.ComponentType<unknown> }> {
  const module = await import('@/features/timeline');
  return { default: module.AnimationListPanel };
}
