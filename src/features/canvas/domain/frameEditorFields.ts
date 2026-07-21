/**
 * Editor state fields that affect canvas frame rendering.
 * Used by useCanvasScene to narrow store subscriptions.
 */
export const FRAME_RELEVANT_EDITOR_FIELDS = [
  'selection', 'view', 'editorMode', 'showSkeleton',
  'hoverHit', 'hoverSource', 'marqueeBox',
  'drawBonePreview', 'brushSize', 'brushHardness', 'blendShapeEditMode',
  'weightPaintBoneId', 'activeBoneId', 'activeConstraintId',
  'interaction',
  'showExportArea', 'exportAreaMoveMode',
] as const;
