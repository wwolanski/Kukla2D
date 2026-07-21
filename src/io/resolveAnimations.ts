/**
 * Resolve which animations to export based on animTarget.
 */
export type AnimationExportTarget = string;

export interface ExportableAnimation {
  id: string;
  name: string;
  duration: number;
  fps?: number;
}

export function resolveAnimations<T extends ExportableAnimation>(
  animations: readonly T[],
  animTarget: AnimationExportTarget,
  activeAnimationId: string | null | undefined,
): readonly (T | ExportableAnimation)[] {
  if (animTarget === 'staging') {
    return [{ id: 'staging', name: 'staging', duration: 0 }];
  }
  if (animTarget === 'current') {
    const active = animations.find(a => a.id === activeAnimationId) ?? animations[0];
    return active ? [active] : [];
  }
  if (animTarget === 'all') return animations;
  const specific = animations.find(a => a.id === animTarget);
  return specific ? [specific] : [];
}
