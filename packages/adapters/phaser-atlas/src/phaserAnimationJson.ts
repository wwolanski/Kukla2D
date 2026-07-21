export interface AnimationJsonFrame {
  key: string;
  frame: string;
  duration: number;
}

export interface AnimationJsonEntry {
  key: string;
  type: 'frame';
  frames: AnimationJsonFrame[];
  frameRate: number;
  skipMissedFrames: boolean;
  delay: number;
  repeat: number;
  repeatDelay: number;
  yoyo: boolean;
}

export interface AnimationJson {
  anims: AnimationJsonEntry[];
  globalTimeScale: number;
}

export interface MarkerEntry {
  id: string;
  time: number;
  label: string;
  animationKey: string;
}

export interface MarkerManifest {
  version: 1;
  markers: MarkerEntry[];
}

export interface AnimationInput {
  animId: string;
  animName: string;
  animationKey: string;
  textureKey: string;
  frameNames: string[];
  fps: number;
  repeat: number;
  markers?: Array<{ id: string; time: number; label: string }>;
}

export function buildAnimationJson(
  animations: readonly AnimationInput[],
): AnimationJson {
  const anims: AnimationJsonEntry[] = [];
  const seen = new Set<string>();

  for (const animation of animations) {
    if (seen.has(animation.animationKey)) {
      throw new Error(`Duplicate animation key: ${animation.animationKey}`);
    }
    seen.add(animation.animationKey);

    const frames: AnimationJsonFrame[] = animation.frameNames.map((frameName) => ({
      key: animation.textureKey,
      frame: frameName,
      duration: 0,
    }));

    anims.push({
      key: animation.animationKey,
      type: 'frame',
      frames,
      frameRate: animation.fps,
      skipMissedFrames: true,
      delay: 0,
      repeat: animation.repeat,
      repeatDelay: 0,
      yoyo: false,
    });
  }

  return { anims, globalTimeScale: 1 };
}

export function buildMarkerManifest(
  animations: readonly AnimationInput[],
): MarkerManifest {
  const markers: MarkerEntry[] = [];

  for (const animation of animations) {
    if (!animation.markers?.length) continue;
    for (const m of animation.markers) {
      markers.push({
        id: m.id,
        time: m.time,
        label: m.label,
        animationKey: animation.animationKey,
      });
    }
  }

  markers.sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));

  return { version: 1, markers };
}
