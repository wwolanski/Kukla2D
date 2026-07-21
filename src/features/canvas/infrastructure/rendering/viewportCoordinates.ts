/**
 * Create coordinate conversion functions that delegate to PixiViewportBridge.
 *
 * @param {{ canvas: HTMLCanvasElement|null, view: { zoom: number, panX: number, panY: number }, sceneGatewayRef: React.MutableRefObject<any> }} deps
 * @returns {{ screenToWorld: (clientX: number, clientY: number) => [number, number], worldToScreen: (worldX: number, worldY: number) => [number, number] }}
 */
import type { CoordinatePair, ViewTransform } from '@/features/canvas/domain/coordinates.js';

import type { CanvasSceneGateway } from './rendererTypes.js';
import type { RefObject } from 'react';

interface ViewportCoordinatesOptions {
  canvas: HTMLCanvasElement;
  view: ViewTransform;
  sceneGatewayRef: RefObject<CanvasSceneGateway | null>;
}

export interface ViewportCoordinates {
  screenToWorld(clientX: number, clientY: number): CoordinatePair;
  worldToScreen(worldX: number, worldY: number): CoordinatePair;
}

export function createViewportCoordinates({ canvas, sceneGatewayRef }: ViewportCoordinatesOptions): ViewportCoordinates {
  return {
    screenToWorld(clientX, clientY) {
      const bridge = sceneGatewayRef.current?.viewportBridge;
      if (bridge) {
        const rect = canvas.getBoundingClientRect();
        const result = bridge.toWorld(clientX - rect.left, clientY - rect.top);
        return [result.x, result.y];
      }
      return [0, 0];
    },
    worldToScreen(worldX, worldY) {
      const bridge = sceneGatewayRef.current?.viewportBridge;
      if (bridge) {
        const result = bridge.toScreen(worldX, worldY);
        return [result.x, result.y];
      }
      return [0, 0];
    },
  };
}
