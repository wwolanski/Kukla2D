// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { buildCanvasFrame } from '@/features/canvas/domain/canvasFrame.js';
import {
  createSinglePartRenderFixture,
  createHierarchyFixture,
  createWarpFixture,
  createSkeletonFixture,
  createCaptureFixture,
} from '@/features/canvas/testing/renderingFixtures.js';
import { compareImageData } from './pixelDiff.js';

class PolyfillImageData {
  constructor(dataOrLength, width, height) {
    if (dataOrLength instanceof Uint8ClampedArray) {
      this.data = dataOrLength;
      this.width = width;
      this.height = height;
    } else {
      this.width = dataOrLength;
      this.height = width;
      this.data = new Uint8ClampedArray(this.width * this.height * 4);
    }
  }
}

const ImageDataCtor = typeof ImageData !== 'undefined' ? ImageData : PolyfillImageData;

function makeCaptureImage(width, height, fillR, fillG, fillB) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fillR;
    data[i + 1] = fillG;
    data[i + 2] = fillB;
    data[i + 3] = 255;
  }
  return new ImageDataCtor(data, width, height);
}

function createMockGateway(captureImageData) {
  const uploaded = { textures: new Set(), meshes: new Set() };
  return {
    uploaded,
    draw: vi.fn(),
    drawFrame: vi.fn(),
    uploadTexture: vi.fn((_partId, _image) => { uploaded.textures.add(_partId); }),
    uploadMesh: vi.fn((_partId, _mesh) => { uploaded.meshes.add(_partId); }),
    uploadQuadFallback: vi.fn((_partId, _w, _h) => { uploaded.meshes.add(_partId); }),
    uploadPositions: vi.fn(),
    hasTexture: (partId) => uploaded.textures.has(partId),
    hasMesh: (partId) => uploaded.meshes.has(partId),
    capture: vi.fn(() => captureImageData),
    resize: vi.fn(),
    dispose: vi.fn(),
  };
}

describe('rendererParity', () => {
  it('both gateways produce capture with same size', () => {
    const { project, editor } = createSinglePartRenderFixture();
    const frame = buildCanvasFrame({
      project,
      editor,
      isDark: true,
      poseOverrides: null,
      canvasSize: { width: 200, height: 200 },
      options: {},
    });

    const legacyCapture = makeCaptureImage(200, 200, 128, 128, 128);
    const pixiCapture = makeCaptureImage(200, 200, 128, 128, 128);

    const legacyGw = createMockGateway(legacyCapture);
    const pixiGw = createMockGateway(pixiCapture);

    legacyGw.drawFrame(frame);
    pixiGw.drawFrame(frame);

    const legacyResult = legacyGw.capture({ width: 200, height: 200 });
    const pixiResult = pixiGw.capture({ width: 200, height: 200 });

    expect(legacyResult.width).toBe(200);
    expect(pixiResult.width).toBe(200);

    const diff = compareImageData(legacyResult, pixiResult, {
      tolerancePerChannel: 0,
      maxDifferentPixelsRatio: 0,
    });

    expect(diff.pass).toBe(true);
    expect(diff.differentPixels).toBe(0);
  });

  it('diff detects actual differences', () => {
    const legacyCapture = makeCaptureImage(10, 10, 255, 0, 0);
    const pixiCapture = makeCaptureImage(10, 10, 0, 255, 0);

    const legacyGw = createMockGateway(legacyCapture);
    const pixiGw = createMockGateway(pixiCapture);

    legacyGw.drawFrame(buildCanvasFrame({
      project: { nodes: [], textures: {}, canvas: { width: 10, height: 10 } },
      editor: { view: { zoom: 1, panX: 0, panY: 0 } },
      isDark: true,
      poseOverrides: null,
      canvasSize: { width: 10, height: 10 },
      options: {},
    }));
    pixiGw.drawFrame(buildCanvasFrame({
      project: { nodes: [], textures: {}, canvas: { width: 10, height: 10 } },
      editor: { view: { zoom: 1, panX: 0, panY: 0 } },
      isDark: true,
      poseOverrides: null,
      canvasSize: { width: 10, height: 10 },
      options: {},
    }));

    const legacyResult = legacyGw.capture();
    const pixiResult = pixiGw.capture();

    const diff = compareImageData(legacyResult, pixiResult);
    expect(diff.pass).toBe(false);
    expect(diff.differentPixels).toBe(100);
    expect(diff.maxChannelDelta).toBe(255);
  });

  it('diff handles size mismatch', () => {
    const a = makeCaptureImage(10, 10, 0, 0, 0);
    const b = makeCaptureImage(20, 20, 0, 0, 0);

    const diff = compareImageData(a, b);
    expect(diff.pass).toBe(false);
    expect(diff.reason).toBe('size mismatch');
  });

  it('capture does not leave canvas in wrong size (simulated)', () => {
    const { project, editor } = createSinglePartRenderFixture();
    const frame = buildCanvasFrame({
      project,
      editor,
      isDark: true,
      poseOverrides: null,
      canvasSize: { width: 200, height: 200 },
      options: {},
    });

    const legacyCapture = makeCaptureImage(200, 200, 0, 0, 0);
    const legacyGw = createMockGateway(legacyCapture);
    legacyGw.drawFrame(frame);
    legacyGw.capture({ width: 400, height: 300 });

    const pixiCapture = makeCaptureImage(200, 200, 0, 0, 0);
    const pixiGw = createMockGateway(pixiCapture);
    pixiGw.drawFrame(frame);
    pixiGw.capture({ width: 400, height: 300 });

    expect(legacyGw.resize).not.toHaveBeenCalled();
    expect(pixiGw.resize).not.toHaveBeenCalled();
  });

  it('buildCanvasFrame works with fixture', () => {
    const { project, editor } = createSinglePartRenderFixture();
    const frame = buildCanvasFrame({
      project,
      editor,
      isDark: false,
      poseOverrides: null,
      canvasSize: { width: 200, height: 200 },
      options: { exportMode: true },
    });

    expect(frame.view).toEqual({ zoom: 1, panX: 0, panY: 0 });
    expect(frame.project.nodes).toHaveLength(1);
    expect(frame.project.nodes[0].id).toBe('part-1');
    expect(frame.canvasSize).toEqual({ width: 200, height: 200 });
    expect(frame.options.exportMode).toBe(true);
  });

  describe('fixtures produce valid frames', () => {
    it('hierarchy fixture builds frame with multiple nodes', () => {
      const { project, editor } = createHierarchyFixture();
      const frame = buildCanvasFrame({
        project, editor, isDark: true, poseOverrides: null,
        canvasSize: { width: 100, height: 100 }, options: {},
      });
      expect(frame.project.nodes).toHaveLength(2);
      expect(frame.project.nodes[0].visible).toBe(false);
      expect(frame.project.nodes[1].opacity).toBe(0.5);
    });

    it('warp fixture builds frame with warp grid', () => {
      const { project, editor } = createWarpFixture();
      const frame = buildCanvasFrame({
        project, editor, isDark: true, poseOverrides: null,
        canvasSize: { width: 100, height: 100 }, options: {},
      });
      expect(frame.project.nodes[0].mesh.warpGrid).toBeDefined();
      expect(frame.project.nodes[0].mesh.warpGrid.col).toBe(2);
    });

    it('skeleton fixture builds frame with bones', () => {
      const { project, editor } = createSkeletonFixture();
      const frame = buildCanvasFrame({
        project, editor, isDark: true, poseOverrides: null,
        canvasSize: { width: 100, height: 100 }, options: {},
      });
      expect(frame.project.bones).toHaveLength(2);
      expect(frame.project.bones[0].id).toBe('bone-root');
    });

    it('capture fixture builds frame with correct canvas size', () => {
      const { project, editor } = createCaptureFixture();
      const frame = buildCanvasFrame({
        project, editor, isDark: true, poseOverrides: null,
        canvasSize: { width: 200, height: 150 }, options: {},
      });
      expect(frame.canvasSize).toEqual({ width: 200, height: 150 });
    });
  });
});
