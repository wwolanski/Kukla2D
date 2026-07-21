import { useCallback } from 'react';

import type { Animation } from '@kukla2d/contracts';

interface AnimationCreationResult {
  affectedIds?: readonly string[];
}

interface AnimationBootstrapOptions {
  activeClip: Animation | null;
  animations: readonly Animation[];
  selectClip: (animationId: string) => string | null;
  createClip: () => AnimationCreationResult;
}

export function useAnimationBootstrap({
  activeClip,
  animations,
  selectClip,
  createClip,
}: AnimationBootstrapOptions): { ensureAnimation: () => string | null } {
  const ensureAnimation = useCallback(() => {
    if (activeClip) return activeClip.id;

    const firstAnimationId = animations[0]?.id ?? null;
    if (firstAnimationId) {
      return selectClip(firstAnimationId);
    }

    const result = createClip();
    return result?.affectedIds?.[0] ?? null;
  }, [activeClip, animations, createClip, selectClip]);

  return { ensureAnimation };
}
