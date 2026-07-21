/**
 * Project Export Area — K2 contract.
 *
 * project.canvas is the single canonical export rectangle (C1).
 * Resolution and crop from persisted canvas fields.
 *
 * R1: resolveProjectExportArea(canvas, scale):
 *   - source {x,y,width,height} from canvas, validated finite/positive
 *   - output dimensions: round(width*scale), round(height*scale), min 1
 *   - crop always covers the full source rectangle
 */

import type { Canvas, ExportAreaContract } from '@kukla2d/contracts';

export function resolveProjectExportArea(canvas: Canvas, { scale = 1 }: { scale?: number } = {}): ExportAreaContract {
  if (!canvas || typeof canvas !== 'object') {
    throw new TypeError('resolveProjectExportArea: canvas must be an object');
  }

  const x = Number(canvas.x ?? 0);
  const y = Number(canvas.y ?? 0);
  const width = Number(canvas.width ?? 0);
  const height = Number(canvas.height ?? 0);
  const s = Number(scale);

  if (!Number.isFinite(x)) throw new RangeError(`resolveProjectExportArea: canvas.x must be finite, got ${canvas.x}`);
  if (!Number.isFinite(y)) throw new RangeError(`resolveProjectExportArea: canvas.y must be finite, got ${canvas.y}`);
  if (!Number.isFinite(width) || width <= 0) throw new RangeError(`resolveProjectExportArea: canvas.width must be > 0, got ${canvas.width}`);
  if (!Number.isFinite(height) || height <= 0) throw new RangeError(`resolveProjectExportArea: canvas.height must be > 0, got ${canvas.height}`);
  if (!Number.isFinite(s) || s <= 0) throw new RangeError(`resolveProjectExportArea: scale must be > 0, got ${scale}`);

  return {
    source: { x, y, width, height },
    outputWidth: Math.max(1, Math.round(width * s)),
    outputHeight: Math.max(1, Math.round(height * s)),
  };
}
