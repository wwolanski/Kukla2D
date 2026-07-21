import type { CapturedRasterFrame } from '@kukla2d/contracts';

import { createFrameCaptureRequestFromRasterPlan } from '@/features/export/domain/createFrameCaptureRequestFromRasterPlan';

import type { CaptureRasterFramesOptions, CaptureRasterFramesResult } from './exportApplicationTypes.js';

export async function captureRasterFrames({ plan, captureFrame, format, onProgress, signal }: CaptureRasterFramesOptions): Promise<CaptureRasterFramesResult> {
  if (!plan || !plan.frameSpecs) {
    return { ok: false, error: { code: 'INVALID_PLAN', message: 'Invalid raster export plan' } };
  }

  const frames: CapturedRasterFrame[] = [];
  const total = plan.frameSpecs.length;

  for (let i = 0; i < total; i++) {
    if (signal?.aborted) {
      return { ok: false, cancelled: true };
    }

    const spec = plan.frameSpecs[i]!;
    onProgress?.({ current: i + 1, total, label: `${spec.animName} — frame ${spec.frameIndex + 1}` });

    const request = createFrameCaptureRequestFromRasterPlan({
      area: plan.area,
      frameSpec: spec,
      format: format ?? 'png',
      bgEnabled: plan.background.enabled,
      bgColor: plan.background.color,
    });

    const result = captureFrame(request);
    if (!result || !result.ok) {
      return {
        ok: false,
        error: result?.error ?? { code: 'CAPTURE_FAILED', message: 'Capture returned no result' },
      };
    }

    frames.push({
      animationId: spec.animId,
      animationName: spec.animName,
      frameIndex: spec.frameIndex,
      timeMs: spec.timeMs,
      width: result.width,
      height: result.height,
      dataUrl: result.dataUrl,
    });

    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  return { ok: true, frames };
}
