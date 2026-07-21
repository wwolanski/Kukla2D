import type { buildSkeletonFrame } from '@/features/canvas/domain/skeletonFrame.js';

import type { Graphics } from 'pixi.js';

type SkeletonFrame = NonNullable<ReturnType<typeof buildSkeletonFrame>>;

export function drawSkeleton(graphics: Graphics, frame: SkeletonFrame | null, zoom: number): void {
  graphics.clear();
  if (!frame) return;
  const inactive = 0x71717a;
  const hover = 0xfb923c;
  const selected = 0xfacc15;
  const active = 0x22d3ee;
  const outline = 0x0f172a;
  const invZoom = zoom > 0 ? 1 / zoom : 1;
  for (const line of frame.boneLines) {
    const isSelected = line.isMultiSelected || line.isSelected;
    const isHot = isSelected || line.isActive || line.isHovered;
    const color = line.isHovered ? hover : isSelected ? selected : line.isActive ? active : inactive;
    const width = isSelected ? 3.5 : isHot ? 3 : 2.5;
    graphics.moveTo(line.x1, line.y1).lineTo(line.x2, line.y2)
      .stroke({ width: (width + 4) * invZoom, color: outline, alpha: isHot ? 0.85 : 0.55 });
    graphics.moveTo(line.x1, line.y1).lineTo(line.x2, line.y2)
      .stroke({ width: width * invZoom, color, alpha: isHot ? 0.95 : 0.72 });
  }
  for (const connection of frame.connections) {
    graphics.moveTo(connection.x1, connection.y1).lineTo(connection.x2, connection.y2)
      .stroke({ width: 1.5 * invZoom, color: active, alpha: 0.55 });
  }
  const jointRadius = 5 * invZoom;
  for (const joint of frame.joints) {
    const isSelected = joint.isMultiSelected || joint.isSelected;
    const isHot = isSelected || joint.isActive || joint.isHovered;
    const color = joint.isHovered ? hover : isSelected ? selected : joint.isActive ? active : inactive;
    graphics.circle(joint.x, joint.y, isSelected ? jointRadius * 1.6 : isHot ? jointRadius * 1.3 : jointRadius)
      .fill({ color, alpha: 0.9 })
      .stroke({ width: isSelected ? 2 * invZoom : isHot ? 1.5 * invZoom : 0, color: 0xffffff, alpha: isSelected ? 0.95 : isHot ? 0.9 : 0 });
  }
  const transform = frame.boneTransformFrame;
  if (transform) {
    const ringRadius = (transform.rotateRingRadius ?? 24) * invZoom;
    graphics.moveTo(transform.rotateHandle.x + ringRadius, transform.rotateHandle.y);
    graphics.circle(transform.rotateHandle.x, transform.rotateHandle.y, ringRadius)
      .stroke({ width: 1.5 * invZoom, color: active, alpha: 0.85 })
      .fill({ color: 0xffffff, alpha: 0.001 });
    graphics.moveTo(transform.start.x, transform.start.y).lineTo(transform.rotateHandle.x, transform.rotateHandle.y)
      .stroke({ width: invZoom, color: active, alpha: 0.45 });
    graphics.circle(transform.lengthHandle.x, transform.lengthHandle.y, (transform.lengthHandleRadius ?? 7) * invZoom)
      .fill({ color: 0xec4899, alpha: 0.95 })
      .stroke({ width: 1.5 * invZoom, color: 0xffffff, alpha: 0.9 });
  }
  const pose = frame.poseHandleFrame;
  if (!pose) return;
  graphics.moveTo(pose.pivot.x, pose.pivot.y).lineTo(pose.handle.x, pose.handle.y)
    .stroke({ width: 2 * invZoom, color: selected, alpha: 0.95 });
  graphics.circle(pose.boneTip.x, pose.boneTip.y, 3.5 * invZoom)
    .fill({ color: selected, alpha: 0.95 }).stroke({ width: invZoom, color: 0xffffff, alpha: 0.8 });
  graphics.circle(pose.handle.x, pose.handle.y, 8 * invZoom)
    .fill({ color: 0xef4444, alpha: 0.95 }).stroke({ width: 2 * invZoom, color: outline, alpha: 1 });
  graphics.circle(pose.handle.x, pose.handle.y, 2.5 * invZoom).fill({ color: outline, alpha: 1 });
}
