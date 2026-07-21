declare module 'gifenc' {
  export type GifPalette = number[][];
  export type GifPaletteFormat = 'rgb565' | 'rgba4444';

  export interface GifEncoder {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      options: {
        palette: number[][];
        delay: number;
        repeat: number;
        transparent?: boolean;
        transparentIndex?: number;
        dispose?: number;
      },
    ): void;
    finish(): void;
    bytes(): Uint8Array;
  }

  export function GIFEncoder(): GifEncoder;
  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options: { format: GifPaletteFormat; clearAlpha?: boolean },
  ): GifPalette;
  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: GifPalette,
    format: GifPaletteFormat,
  ): Uint8Array;
}
