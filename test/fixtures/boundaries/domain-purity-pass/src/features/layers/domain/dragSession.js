export function computeDropPosition({ clientY, top, height } = {}, defaultPosition = 'inside') {
  if (!height || height <= 0) return defaultPosition;
  const y = clientY - top;
  const ratio = y / height;
  if (ratio < 0.25) return 'before';
  if (ratio > 0.75) return 'after';
  return defaultPosition;
}

export function createDragSession(sourceKind, sourceId) {
  return { sourceKind, sourceId, targetKind: null, targetId: null, dropPosition: null };
}
