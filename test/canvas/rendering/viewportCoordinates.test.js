import { describe, it, expect } from 'vitest';
import { createViewportCoordinates } from '@/features/canvas/infrastructure/rendering/viewportCoordinates.js';

function makeCanvas(rect = { left: 100, top: 200, width: 800, height: 600 }) {
  return { getBoundingClientRect: () => rect };
}

function makeGatewayRef(viewportBridge) {
  return { current: viewportBridge ? { viewportBridge } : null };
}

describe('createViewportCoordinates', () => {
  it('delegates to bridge.toWorld when available', () => {
    const canvas = makeCanvas({ left: 100, top: 200 });
    const view = { zoom: 1, panX: 0, panY: 0 };
    const bridge = {
      toWorld: (x, y) => ({ x: x + 5, y: y + 10 }),
    };
    const coords = createViewportCoordinates({
      canvas, view, sceneGatewayRef: makeGatewayRef(bridge),
    });
    const [wx, wy] = coords.screenToWorld(130, 260);
    expect(wx).toBe(35);
    expect(wy).toBe(70);
  });

  it('delegates to bridge.toScreen when available', () => {
    const canvas = makeCanvas();
    const view = { zoom: 1, panX: 0, panY: 0 };
    const bridge = {
      toScreen: (x, y) => ({ x: x + 100, y: y + 200 }),
    };
    const coords = createViewportCoordinates({
      canvas, view, sceneGatewayRef: makeGatewayRef(bridge),
    });
    const [sx, sy] = coords.worldToScreen(10, 20);
    expect(sx).toBe(110);
    expect(sy).toBe(220);
  });

  it('returns zero when bridge is not ready', () => {
    const canvas = makeCanvas({ left: 0, top: 0 });
    const view = { zoom: 2, panX: 10, panY: 20 };
    const coords = createViewportCoordinates({
      canvas, view, sceneGatewayRef: makeGatewayRef(null),
    });
    const [x, y] = coords.screenToWorld(100, 200);
    expect(x).toBe(0);
    expect(y).toBe(0);
  });

  it('returns zero when gateway ref is null', () => {
    const canvas = makeCanvas({ left: 0, top: 0 });
    const view = { zoom: 1, panX: 0, panY: 0 };
    const coords = createViewportCoordinates({
      canvas, view, sceneGatewayRef: { current: null },
    });
    const [x, y] = coords.screenToWorld(100, 200);
    expect(x).toBe(0);
    expect(y).toBe(0);
  });

  it('worldToScreen returns zero when bridge is not ready', () => {
    const canvas = makeCanvas();
    const view = { zoom: 1, panX: 0, panY: 0 };
    const coords = createViewportCoordinates({
      canvas, view, sceneGatewayRef: makeGatewayRef(null),
    });
    const [sx, sy] = coords.worldToScreen(10, 20);
    expect(sx).toBe(0);
    expect(sy).toBe(0);
  });
});
