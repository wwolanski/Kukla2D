import { BoneAssignPrompt } from '@/features/canvas/overlays/skeleton/BoneAssignPrompt.jsx';
import { IkAssignPrompt } from '@/features/canvas/overlays/skeleton/IkAssignPrompt.jsx';

/**
 * OverlayLayer — DOM overlays for non-canvas UI only.
 *
 * Canvas gesture overlays (gizmo, skeleton, warp, marquee, weight paint,
 * brush, hover) are rendered by PixiOverlayRenderer in Pixi mode.
 * This component retains only DOM prompts (bone assign).
 */
export default function OverlayLayer({ view }) {
  return (
    <>
      <BoneAssignPrompt view={view} />
      <IkAssignPrompt view={view} />
    </>
  );
}
