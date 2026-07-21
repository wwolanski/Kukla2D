import { createPixiSceneGateway } from './pixi/createPixiSceneGateway.js';

import type { EditorView } from './rendererTypes.js';

/** Create canvas renderer. Pixi is the sole runtime backend. */
export interface CreateCanvasRendererOptions {
  canvas: HTMLCanvasElement;
  onViewChange?: (view: EditorView) => void;
  initialView?: EditorView;
}

export function createCanvasRenderer(
  options: CreateCanvasRendererOptions,
): ReturnType<typeof createPixiSceneGateway> {
  return createPixiSceneGateway(options);
}
