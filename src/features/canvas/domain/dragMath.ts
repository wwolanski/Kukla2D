/**
 * Shared pure drag math helpers.
 *
 * Extracted from useGizmoDrag.js. No React, DOM, WebGL, or Pixi imports.
 * Used by Pixi input system.
 */

/**
 * Compute move delta in world-space from a client-space drag.
 *
 * @param {{ startClientX: number, startClientY: number, currentClientX: number, currentClientY: number, zoom: number }} args
 * @returns {{ dx: number, dy: number }}
 */
interface Point { x: number; y: number }
interface MoveDeltaInput { startClientX: number; startClientY: number; currentClientX: number; currentClientY: number; zoom: number }
interface RotationDeltaInput { startAngle: number; currentPoint: Point; pivotPoint: Point; snap15?: boolean }
interface PivotTransformInput {
  startPivotX: number; startPivotY: number; startX: number; startY: number;
  localDeltaX: number; localDeltaY: number; rotation: number; scaleX: number; scaleY: number;
}

export function computeMoveDelta({ startClientX, startClientY, currentClientX, currentClientY, zoom }: MoveDeltaInput): { dx: number; dy: number } {
  const z = zoom || 1;
  return {
    dx: (currentClientX - startClientX) / z,
    dy: (currentClientY - startClientY) / z,
  };
}

/**
 * Compute rotation delta in degrees from two angles.
 *
 * @param {{ startAngle: number, currentPoint: { x: number, y: number }, pivotPoint: { x: number, y: number }, snap15?: boolean }} args
 * @returns {number} rotation delta in degrees
 */
export function computeRotationDelta({ startAngle, currentPoint, pivotPoint, snap15 = false }: RotationDeltaInput): number {
  const dx = currentPoint.x - pivotPoint.x;
  const dy = currentPoint.y - pivotPoint.y;
  const currentAngle = Math.atan2(dy, dx);
  let delta = (currentAngle - startAngle) * (180 / Math.PI);
  if (snap15) delta = Math.round(delta / 15) * 15;
  return delta;
}

/**
 * Compute the pivot transform patch when moving the pivot point.
 *
 * When the pivot moves by (localDeltaX, localDeltaY) in local space,
 * the node position must be compensated to keep the visual transform stable.
 *
 * @param {{ startPivotX: number, startPivotY: number, startX: number, startY: number, localDeltaX: number, localDeltaY: number, rotation: number, scaleX: number, scaleY: number }} args
 * @returns {{ pivotX: number, pivotY: number, x: number, y: number }}
 */
export function computePivotTransformPatch({
  startPivotX, startPivotY, startX, startY,
  localDeltaX, localDeltaY,
  rotation, scaleX, scaleY,
}: PivotTransformInput): { pivotX: number; pivotY: number; x: number; y: number } {
  const θ = (rotation || 0) * (Math.PI / 180);
  const c = Math.cos(θ), s = Math.sin(θ);
  const sX = scaleX ?? 1;
  const sY = scaleY ?? 1;

  const m0 = sX * c;
  const m1 = sX * s;
  const m3 = -sY * s;
  const m4 = sY * c;

  return {
    pivotX: startPivotX + localDeltaX,
    pivotY: startPivotY + localDeltaY,
    x: startX + localDeltaX * (m0 - 1) + localDeltaY * m3,
    y: startY + localDeltaX * m1 + localDeltaY * (m4 - 1),
  };
}
