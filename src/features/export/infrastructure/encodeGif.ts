import { GIFEncoder, quantize, applyPalette } from 'gifenc';

import type { EncoderInput, ExportArtifact } from '@kukla2d/contracts';

type RgbaTuple = [number, number, number, number];

function hexToRgba(hex: string): RgbaTuple {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const a = hex.length === 9 ? parseInt(hex.slice(7, 9), 16) : 255;
  return [r, g, b, a];
}

function compositeOverBackground(rgba: Uint8ClampedArray, width: number, height: number, bgHex: string): Uint8Array {
  const bg = hexToRgba(bgHex);
  const out = new Uint8Array(rgba.length);
  const [bgR, bgG, bgB] = bg;
  const bgA = bg[3] / 255;
  for (let i = 0; i < rgba.length; i += 4) {
    const srcA = (rgba[i + 3] ?? 0) / 255;
    if (srcA >= 1 && bgA >= 1) {
      out[i] = rgba[i] ?? 0;
      out[i + 1] = rgba[i + 1] ?? 0;
      out[i + 2] = rgba[i + 2] ?? 0;
      out[i + 3] = 255;
    } else {
      const outA = srcA + bgA * (1 - srcA);
      if (outA < 1e-6) {
        out[i] = 0; out[i + 1] = 0; out[i + 2] = 0; out[i + 3] = 0;
      } else {
        out[i] = Math.round(((rgba[i] ?? 0) * srcA + bgR * bgA * (1 - srcA)) / outA);
        out[i + 1] = Math.round(((rgba[i + 1] ?? 0) * srcA + bgG * bgA * (1 - srcA)) / outA);
        out[i + 2] = Math.round(((rgba[i + 2] ?? 0) * srcA + bgB * bgA * (1 - srcA)) / outA);
        out[i + 3] = Math.round(outA * 255);
      }
    }
  }
  return out;
}

function clampDelay(fps: number): number {
  return Math.max(10, Math.round(1000 / fps / 10) * 10);
}

function sanitizeName(name: string): string {
  return (name || 'animation').replace(/[^a-zA-Z0-9_-]/g, '_');
}

export async function rgbaFromDataUrl(dataUrl: string): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas is not available for GIF export');
    ctx.drawImage(bitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    return { data: imageData.data, width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}

export async function encodeGif({ frames, area, fps, background, animationName, onProgress, signal }: EncoderInput): Promise<ExportArtifact[]> {
  if (!frames || frames.length === 0) return [];

  const width = area.outputWidth;
  const height = area.outputHeight;
  const delay = clampDelay(fps);
  const nameSource = animationName || 'animation';

  const fileName = sanitizeName(nameSource);

  const gif = GIFEncoder();

  for (let i = 0; i < frames.length; i++) {
    if (signal?.aborted) return [];

    const frame = frames[i]!;

    if (frame.width !== width || frame.height !== height) {
      throw new Error(
        `Frame ${frame.frameIndex + 1} dimensions ${frame.width}x${frame.height} ` +
        `do not match plan ${width}x${height}`
      );
    }

    onProgress?.({ current: i, total: frames.length, label: `Encoding frame ${i + 1}...` });

    const { data } = await rgbaFromDataUrl(frame.dataUrl);

    let quantizeData: Uint8Array | Uint8ClampedArray = data;
    let transparent = false;
    let transparentIndex;

    if (background.enabled) {
      quantizeData = compositeOverBackground(data, width, height, background.color);
    } else {
      transparent = true;
    }

    const paletteFormat = background.enabled ? 'rgb565' : 'rgba4444';
    const palette = quantize(quantizeData, 255, {
      format: paletteFormat,
      clearAlpha: true,
    });

    const index = applyPalette(quantizeData, palette, paletteFormat);

    if (transparent) {
      const ti = palette.findIndex((color) => color.length >= 4 && color[3] === 0);
      if (ti >= 0) transparentIndex = ti;
    }

    const rgbPalette = palette.map((color) => [color[0] ?? 0, color[1] ?? 0, color[2] ?? 0]);

    const frameOptions = {
      palette: rgbPalette,
      delay,
      repeat: 0,
      transparent,
      ...(transparentIndex === undefined ? {} : { transparentIndex }),
      ...(transparent ? { dispose: 2 } : {}),
    };
    gif.writeFrame(index, width, height, frameOptions);

  }

  gif.finish();
  const bytes = gif.bytes();
  const blob = new Blob([new Uint8Array(bytes).buffer], { type: 'image/gif' });
  const gifFileName = `${fileName}.gif`;

  return [{ fileName: gifFileName, mimeType: 'image/gif', blob, relativePath: gifFileName }];
}
