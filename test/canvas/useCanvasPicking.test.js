// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { pickPartAtClientPoint } from '@/features/canvas/application/useCanvasPicking.js';
import { computeWorldMatrices } from '@/domain/transforms';

function makeImageData(w, h, fill = 0) {
  const data = new Uint8ClampedArray(w * h * 4);
  if (fill > 0) {
    for (let i = 3; i < data.length; i += 4) data[i] = fill;
  }
  return { width: w, height: h, data };
}

describe('pickPartAtClientPoint', () => {
  const partNode = {
    id: 'part-1', type: 'part', visible: true, opacity: 1,
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
    mesh: { vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }] },
  };

  it('returns null when canvas is missing', () => {
    const hit = pickPartAtClientPoint({
      clientX: 50, clientY: 50,
      canvas: null,
      view: { zoom: 1, panX: 0, panY: 0 },
      effectiveNodes: [partNode],
      worldMatrices: new Map(),
      imageDataMap: new Map(),
      viewportBridge: null,
    });
    expect(hit).toBeNull();
  });

  it('picks part using legacy coordinate path', () => {
    const canvas = document.createElement('canvas');
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });

    const imageData = makeImageData(100, 100, 255);

    const worldMatrices = computeWorldMatrices([partNode]);

    const hit = pickPartAtClientPoint({
      clientX: 50, clientY: 50,
      canvas,
      view: { zoom: 1, panX: 0, panY: 0 },
      effectiveNodes: [partNode],
      worldMatrices,
      imageDataMap: new Map([['part-1', imageData]]),
      viewportBridge: null,
    });
    expect(hit).toBe('part-1');
  });

  it('returns null when alpha is zero', () => {
    const canvas = document.createElement('canvas');
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });

    const imageData = makeImageData(100, 100, 0);

    const worldMatrices = computeWorldMatrices([partNode]);

    const hit = pickPartAtClientPoint({
      clientX: 50, clientY: 50,
      canvas,
      view: { zoom: 1, panX: 0, panY: 0 },
      effectiveNodes: [partNode],
      worldMatrices,
      imageDataMap: new Map([['part-1', imageData]]),
      viewportBridge: null,
    });
    expect(hit).toBeNull();
  });

  it('picks using pixi viewportBridge', () => {
    const canvas = document.createElement('canvas');
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });

    const imageData = makeImageData(100, 100, 255);

    const viewportBridge = {
      toWorld: (sx, sy) => ({ x: sx, y: sy }),
    };

    const worldMatrices = computeWorldMatrices([partNode]);

    const hit = pickPartAtClientPoint({
      clientX: 50, clientY: 50,
      canvas,
      view: { zoom: 1, panX: 0, panY: 0 },
      effectiveNodes: [partNode],
      worldMatrices,
      imageDataMap: new Map([['part-1', imageData]]),
      viewportBridge,
    });
    expect(hit).toBe('part-1');
  });

  it('returns null for pixi without bridge', () => {
    const canvas = document.createElement('canvas');
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });

    const hit = pickPartAtClientPoint({
      clientX: 50, clientY: 50,
      canvas,
      view: { zoom: 1, panX: 0, panY: 0 },
      effectiveNodes: [partNode],
      worldMatrices: new Map(),
      imageDataMap: new Map(),
      viewportBridge: null,
    });
    expect(hit).toBeNull();
  });

  it('applies zoom offset in legacy path', () => {
    const canvas = document.createElement('canvas');
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });

    const imageData = makeImageData(100, 100, 255);

    const worldMatrices = computeWorldMatrices([partNode]);

    const hit = pickPartAtClientPoint({
      clientX: 250, clientY: 250,
      canvas,
      view: { zoom: 2, panX: 100, panY: 100 },
      effectiveNodes: [partNode],
      worldMatrices,
      imageDataMap: new Map([['part-1', imageData]]),
      viewportBridge: null,
    });
    expect(hit).toBe('part-1');
  });
});
