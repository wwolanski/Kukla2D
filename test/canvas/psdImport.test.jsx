// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '../renderHook.jsx';
import { useCanvasImport } from '@/features/canvas/application/useCanvasImport.js';

const psdMock = vi.hoisted(() => ({ importPsd: vi.fn() }));
vi.mock('@/io/psd', () => psdMock);

function imageData(width, height) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  return { width, height, data };
}

describe('PSD import', () => {
  let originalCreateElement;

  beforeEach(() => {
    originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
      if (String(tagName).toLowerCase() !== 'canvas') {
        return originalCreateElement(tagName, options);
      }
      return {
        width: 0,
        height: 0,
        getContext: vi.fn(() => ({
          drawImage: vi.fn(),
          getImageData: vi.fn((x, y, width, height) => imageData(width, height)),
          putImageData: vi.fn(),
        })),
        toBlob: vi.fn(),
      };
    });
  });

  afterEach(() => {
    document.createElement.mockRestore();
  });

  it('imports SeeThrough-style layers directly without a legacy wizard', async () => {
    const layers = [
      { name: 'eyewhite-l', x: 0, y: 0, width: 2, height: 2, imageData: imageData(2, 2), opacity: 1, visible: true },
      { name: 'irides-l', x: 0, y: 0, width: 2, height: 2, imageData: imageData(2, 2), opacity: 1, visible: true },
      { name: 'face', x: 0, y: 0, width: 2, height: 2, imageData: imageData(2, 2), opacity: 1, visible: true },
      { name: 'front hair', x: 0, y: 0, width: 2, height: 2, imageData: imageData(2, 2), opacity: 1, visible: true },
    ];
    psdMock.importPsd.mockResolvedValue({ width: 4, height: 4, layers });

    const project = {
      canvas: {},
      textures: [],
      nodes: [],
      libraryFolders: [],
      assetPlacements: [],
    };
    const version = { textureVersion: 0 };
    const updateProject = vi.fn((recipe) => recipe(project, version));
    const { result } = renderHook(() => useCanvasImport({
      projectRef: { current: project },
      canvasRef: { current: null },
      editorRef: { current: null },
      updateProject,
      resetProject: vi.fn(),
      centerView: vi.fn(),
      sceneGatewayRef: { current: null },
      textureCache: { __internal: { imageDataByPartId: new Map() } },
      markDirty: vi.fn(),
      setConfirmWipeOpen: vi.fn(),
      pendingFile: null,
      setPendingFile: vi.fn(),
      animRef: { current: null },
      sendWorkflowEvent: vi.fn(),
      resourceOwnerRef: { current: null },
    }));

    await act(async () => {
      await result.current.processPsdFile({
        name: 'seethrough_output.psd',
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
      });
    });

    expect(project.nodes).toHaveLength(layers.length);
    expect(project.nodes.map(node => node.name)).toEqual(layers.map(layer => layer.name));
    expect(project.nodes.find(node => node.name === 'irides-l')?.clipToPartId)
      .toBe(project.nodes.find(node => node.name === 'eyewhite-l')?.id);
    expect(project.libraryFolders).toEqual([
      expect.objectContaining({ name: 'seethrough_output', sourceFileName: 'seethrough_output.psd' }),
    ]);
  });
});
