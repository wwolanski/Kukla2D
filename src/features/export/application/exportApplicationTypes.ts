import type {
  CapturedRasterFrame,
  EncoderInput,
  ExportAreaContract,
  ExportArtifact,
  RasterFrameSpec,
} from '@kukla2d/contracts';

import type { CaptureFrame, FrameCaptureError } from '../domain/frameCaptureTypes.js';
import type { BrowserExportResult } from '../infrastructure/browserExportSink.js';
export type { CaptureFrame } from '../domain/frameCaptureTypes.js';

export interface ExportProgress {
  current: number;
  total: number;
  label: string;
}

type ExportFailure = FrameCaptureError;
export type ExportEncoder = (input: EncoderInput) => Promise<ExportArtifact[]>;
export type ExportOutputSink = (
  artifacts: readonly ExportArtifact[],
  options?: { destination?: 'download' | 'folder' | 'zip'; projectName?: string },
) => Promise<BrowserExportResult>;

export interface CaptureRasterFramesOptions {
  plan: Readonly<{
    area: ExportAreaContract;
    background: { enabled: boolean; color: string };
    frameSpecs: readonly RasterFrameSpec[];
  }>;
  captureFrame: CaptureFrame;
  format?: 'png' | 'webp' | undefined;
  onProgress?: ((progress: ExportProgress | null) => void) | undefined;
  signal?: AbortSignal | undefined;
}

export type CaptureRasterFramesResult =
  | { ok: true; frames: CapturedRasterFrame[] }
  | { ok: false; cancelled: true }
  | { ok: false; error: ExportFailure };

export type ExportRunResult =
  | { ok: true; artifacts: ExportArtifact[] }
  | { ok: false; cancelled: true }
  | { ok: false; error: ExportFailure };

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
