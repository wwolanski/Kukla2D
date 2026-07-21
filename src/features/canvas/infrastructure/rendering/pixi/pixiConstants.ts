export const PIXI_BACKGROUND_ALPHA = 0;

export const PIXI_RENDERER_OPTIONS = {
  backgroundAlpha: PIXI_BACKGROUND_ALPHA,
  antialias: true,
  autoDensity: true,
  preference: 'webgl',
} satisfies Partial<ApplicationOptions>;

export const DEFAULT_WORLD_WIDTH = 10000;
export const DEFAULT_WORLD_HEIGHT = 10000;
import type { ApplicationOptions } from 'pixi.js';
