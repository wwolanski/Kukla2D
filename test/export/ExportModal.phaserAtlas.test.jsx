// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

const mockStores = vi.hoisted(() => ({
  useAnimationStore: vi.fn(() => ({ activeAnimationId: 'idle', fps: 24 })),
  useProjectStore: vi.fn(() => ({
    project: {
      canvas: { width: 512, height: 512 },
      animations: [
        { id: 'idle', name: 'Idle', duration: 1000, fps: 12 },
        { id: 'walk', name: 'Walk', duration: 2000, fps: 24 },
      ],
      nodes: [],
      bones: [],
      textures: [],
    },
  })),
}));

vi.mock('@/store/animationStore', () => mockStores);
vi.mock('@/store/projectStore', () => mockStores);

const mockRasterForm = vi.hoisted(() => ({
  useRasterExportForm: vi.fn(() => ({
    frame: {
      type: 'spritesheet',
      setType: vi.fn(),
      format: 'png',
      setFormat: vi.fn(),
      variantId: 'png_spritesheet',
      animTarget: 'idle',
      setAnimTarget: vi.fn(),
      exportFps: 24,
      setExportFps: vi.fn(),
      outputScale: 100,
      setOutputScale: vi.fn(),
      bgMode: 'transparent',
      setBgMode: vi.fn(),
      bgColor: '#ffffff',
      setBgColor: vi.fn(),
      exportDest: 'zip',
      setExportDest: vi.fn(),
      targetAnims: [],
      totalFrameCount: 0,
      maxFrameCount: 0,
      expectedArtifactCount: 0,
      canDownloadSingleFile: false,
      spriteSheetColumns: 1,
      setSpriteSheetColumns: vi.fn(),
      spriteSheetLayouts: [],
      isExporting: false,
      hasFolderSupport: false,
    },
    status: {
      progress: null,
      setProgress: vi.fn(),
      isExporting: false,
      setIsExporting: vi.fn(),
      exportError: null,
      setExportError: vi.fn(),
    },
  })),
}));

vi.mock('@/features/export/application/useRasterExportForm', () => mockRasterForm);
vi.mock('@/features/export/application/useRasterExportJob', () => ({
  useRasterExportJob: vi.fn(() => vi.fn()),
}));

const mockPhaserForm = vi.hoisted(() => ({
  usePhaserAtlasExportForm: vi.fn(() => ({
    frame: {
      variantId: 'phaser_atlas',
      animTarget: 'idle',
      setAnimTarget: vi.fn(),
      exportFps: 24,
      setExportFps: vi.fn(),
      outputScale: 100,
      setOutputScale: vi.fn(),
      trim: true,
      setTrim: vi.fn(),
      padding: 2,
      setPadding: vi.fn(),
      maxPageSize: 2048,
      setMaxPageSize: vi.fn(),
      loop: true,
      setLoop: vi.fn(),
      exportDest: 'zip',
      setExportDest: vi.fn(),
      targetAnims: [],
      totalFrameCount: 0,
      estimatedUntrimmedPixels: 0,
      hasFolderSupport: false,
      isExporting: false,
    },
    status: {
      progress: null,
      setProgress: vi.fn(),
      isExporting: false,
      setIsExporting: vi.fn(),
      exportError: null,
      setExportError: vi.fn(),
    },
  })),
}));

vi.mock('@/features/export/application/usePhaserAtlasExportForm', () => mockPhaserForm);
vi.mock('@/features/export/application/usePhaserAtlasExportJob', () => ({
  usePhaserAtlasExportJob: vi.fn(() => ({
    run: vi.fn(),
    cancel: vi.fn(),
  })),
}));
vi.mock('@/features/export/application/useExportReadinessGate', () => ({
  useExportReadinessGate: vi.fn(() => ({
    decision: null,
    runWithGate: vi.fn(),
    continuePending: vi.fn(),
    cancelPending: vi.fn(),
  })),
  resolveExportReadinessTarget: vi.fn(t => t === 'phaser_atlas' ? 'phaser_atlas' : 'frames'),
}));
vi.mock('@/features/export/domain/exportVariantRegistry', () => ({
  resolveActiveExportVariant: vi.fn(id => {
    if (id === 'phaser_atlas') return { id: 'phaser_atlas', status: 'active', pipeline: 'phaser_atlas' };
    if (id === 'png_spritesheet') return { id: 'png_spritesheet', status: 'active', pipeline: 'raster' };
    throw new Error('UNSUPPORTED_FORMAT');
  }),
  listExportTypes: vi.fn(() => [
    { id: 'sequence', label: 'Image sequence', status: 'active' },
    { id: 'spritesheet', label: 'Spritesheet', status: 'active' },
    { id: 'animation', label: 'Animated image', status: 'active' },
    { id: 'phaser_atlas', label: 'Phaser 4.2.1', status: 'active' },
  ]),
  listExportFormats: vi.fn(type => {
    if (type === 'animation') return [{ format: 'gif', formatLabel: 'GIF' }];
    if (type === 'phaser_atlas') return [];
    return [{ format: 'png', formatLabel: 'PNG' }];
  }),
  getDefaultExportFormat: vi.fn(() => 'png'),
  getExportVariantForSelection: vi.fn((type, format) => {
    if (type === 'spritesheet' && format === 'png') return { id: 'png_spritesheet' };
    return null;
  }),
}));

import { ExportModal } from '@/features/export/components/ExportModal';

function mount(element) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(element); });
  return container;
}

describe('ExportModal phaser_atlas integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('renders without crashing in raster mode', () => {
    expect(() => {
      mount(
        <ExportModal
          open={true}
          onClose={vi.fn()}
          captureRef={{ current: vi.fn() }}
          projectName="test"
        />,
      );
    }).not.toThrow();
    expect(document.body.textContent).toContain('Export');
  });

  it('shows raster form options when type is spritesheet', () => {
    mount(
      <ExportModal
        open={true}
        onClose={vi.fn()}
        captureRef={{ current: vi.fn() }}
        projectName="test"
      />,
    );
    expect(document.body.textContent).toContain('Background');
    expect(document.body.textContent).toContain('Spritesheet layout');
  });

  it('does not show phaser-specific options in raster mode', () => {
    mount(
      <ExportModal
        open={true}
        onClose={vi.fn()}
        captureRef={{ current: vi.fn() }}
        projectName="test"
      />,
    );
    expect(document.body.textContent).not.toContain('Texture Atlas (Baked)');
    expect(document.body.textContent).not.toContain('Trim transparent pixels');
  });

  it('does not show single-file destination option', () => {
    mount(
      <ExportModal
        open={true}
        onClose={vi.fn()}
        captureRef={{ current: vi.fn() }}
        projectName="test"
      />,
    );
    expect(document.body.textContent).toContain('Single file');
    expect(document.body.textContent).toContain('ZIP file');
  });
});
