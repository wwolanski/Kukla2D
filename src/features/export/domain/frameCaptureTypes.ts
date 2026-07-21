export interface FrameCaptureRequest {
  animationId: string | null;
  timeMs: number;
  width: number;
  height: number;
  format: 'png' | 'jpg' | 'webp';
  quality: number;
  background: { enabled: boolean; color: string };
  crop: { x: number; y: number; width?: number; height?: number } | null;
}

export interface FrameCaptureError {
  code: string;
  message: string;
}

type FrameCaptureResult =
  | { ok: true; dataUrl: string; width: number; height: number }
  | { ok: false; error: FrameCaptureError };

export type CaptureFrame = (request: FrameCaptureRequest) => FrameCaptureResult;
