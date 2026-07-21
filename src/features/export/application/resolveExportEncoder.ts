import { encodeGif } from '@/features/export/infrastructure/encodeGif';
import { encodePngSequence } from '@/features/export/infrastructure/encodePngSequence';
import { encodePngSpritesheet } from '@/features/export/infrastructure/encodePngSpritesheet';

import type { ExportEncoder } from './exportApplicationTypes.js';

const ENCODER_MAP: Readonly<Record<string, ExportEncoder>> = {
  png_sequence: encodePngSequence,
  png_spritesheet: encodePngSpritesheet,
  gif: encodeGif,
};

/** @param {string} variantId */
export function resolveExportEncoder(variantId: string): ExportEncoder {
  const encoder = ENCODER_MAP[variantId];
  if (!encoder) throw new Error(`No encoder registered for variant: ${variantId}`);
  return encoder;
}
