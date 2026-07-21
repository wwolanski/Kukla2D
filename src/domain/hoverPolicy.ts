export const HOVER_SOURCE_CANVAS = 'canvas';
export const HOVER_SOURCE_PANEL = 'panel';

interface HoverPolicyState {
  selection?: readonly string[];
  activeBoneId?: string | null;
  activeConstraintId?: string | null;
  hoverHit?: string | null;
  hoverSource?: string | null;
}

/**
 * A selected/focused workspace target means the user is already working on it.
 * Passive canvas hover must not compete with that active context.
 */
export function hasActiveCanvasElement(editorState: HoverPolicyState | null | undefined): boolean {
  return (editorState?.selection?.length ?? 0) > 0
    || editorState?.activeBoneId != null
    || editorState?.activeConstraintId != null;
}

/**
 * Panel hover is explicit identification and is always visible. Canvas hover is
 * passive and is visible only while no workspace element is active.
 * Missing source is treated as canvas for backward compatibility and safety.
 */
export function resolveVisibleHoverHit(editorState: HoverPolicyState | null | undefined): string | null {
  const hoverHit = editorState?.hoverHit ?? null;
  if (hoverHit == null) return null;
  if (editorState?.hoverSource === HOVER_SOURCE_PANEL) return hoverHit;
  return hasActiveCanvasElement(editorState) ? null : hoverHit;
}
