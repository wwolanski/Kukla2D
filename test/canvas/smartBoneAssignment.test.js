import { describe, it, expect } from 'vitest';
import { findSmartBoneAssignmentCandidate } from '@/features/canvas/domain/smartBoneAssignment.js';

function makePart(id, width, height, transform) {
  return {
    id,
    type: 'part',
    transform: transform ?? { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
    imageWidth: width,
    imageHeight: height,
  };
}

function makeImageData(width, height, fillAlpha) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 3; i < data.length; i += 4) {
    data[i] = fillAlpha;
  }
  return { width, height, data };
}

function makeImageDataRect(width, height, rectX, rectY, rectW, rectH, fillAlpha = 255) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let py = rectY; py < rectY + rectH; py++) {
    for (let px = rectX; px < rectX + rectW; px++) {
      const idx = (py * width + px) * 4 + 3;
      data[idx] = fillAlpha;
    }
  }
  return { width, height, data };
}

describe('findSmartBoneAssignmentCandidate', () => {
  it('returns the part with highest coverage when bone crosses two parts', () => {
    const imageDataByPartId = new Map();
    const imageDataA = makeImageDataRect(200, 200, 0, 0, 200, 200, 255);
    const imageDataB = makeImageDataRect(200, 200, 180, 0, 20, 200, 255);
    imageDataByPartId.set('partA', imageDataA);
    imageDataByPartId.set('partB', imageDataB);

    const nodes = [
      makePart('partA', 200, 200),
      makePart('partB', 200, 200),
    ];

    const result = findSmartBoneAssignmentCandidate({
      nodes,
      imageDataByPartId,
      startWorldX: 0,
      startWorldY: 100,
      endWorldX: 200,
      endWorldY: 100,
      samples: 11,
    });

    expect(result.nodeId).toBe('partA');
    expect(result.coverage).toBeGreaterThan(0.7);
  });

  it('returns null when no part has alpha coverage', () => {
    const imageDataByPartId = new Map();
    const imageDataA = makeImageData(50, 50, 0);
    imageDataByPartId.set('partA', imageDataA);

    const result = findSmartBoneAssignmentCandidate({
      nodes: [makePart('partA', 50, 50)],
      imageDataByPartId,
      startWorldX: 0,
      startWorldY: 0,
      endWorldX: 10,
      endWorldY: 10,
      samples: 11,
    });

    expect(result.nodeId).toBeNull();
    expect(result.coverage).toBe(0);
  });

  it('returns null when imageDataByPartId is empty', () => {
    const result = findSmartBoneAssignmentCandidate({
      nodes: [makePart('partA', 50, 50)],
      imageDataByPartId: new Map(),
      startWorldX: 0,
      startWorldY: 0,
      endWorldX: 10,
      endWorldY: 10,
      samples: 11,
    });

    expect(result.nodeId).toBeNull();
    expect(result.coverage).toBe(0);
  });

  it('returns the only part with coverage when bone lies on one part', () => {
    const imageDataByPartId = new Map();
    const imageData = makeImageDataRect(100, 100, 0, 0, 100, 100, 255);
    imageDataByPartId.set('partA', imageData);

    const result = findSmartBoneAssignmentCandidate({
      nodes: [makePart('partA', 100, 100)],
      imageDataByPartId,
      startWorldX: 10,
      startWorldY: 10,
      endWorldX: 90,
      endWorldY: 10,
      samples: 11,
    });

    expect(result.nodeId).toBe('partA');
    expect(result.coverage).toBe(1);
  });

  it('clamps samples to [5, 25]', () => {
    const imageDataByPartId = new Map();
    const imageData = makeImageDataRect(50, 50, 0, 0, 50, 50, 255);
    imageDataByPartId.set('partA', imageData);

    const resultLow = findSmartBoneAssignmentCandidate({
      nodes: [makePart('partA', 50, 50)],
      imageDataByPartId,
      startWorldX: 0, startWorldY: 0,
      endWorldX: 50, endWorldY: 0,
      samples: 1,
    });
    expect(resultLow.nodeId).toBe('partA');

    const resultHigh = findSmartBoneAssignmentCandidate({
      nodes: [makePart('partA', 50, 50)],
      imageDataByPartId,
      startWorldX: 0, startWorldY: 0,
      endWorldX: 50, endWorldY: 0,
      samples: 100,
    });
    expect(resultHigh.nodeId).toBe('partA');
  });
});
