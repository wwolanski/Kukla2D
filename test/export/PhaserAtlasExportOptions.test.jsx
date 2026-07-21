// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

vi.mock('@/features/export/domain/phaserAtlasContract', () => ({
  PHASER_ATLAS_OPTIONS: {
    fps: { min: 1, max: 120 },
    scale: { min: 1, max: 400 },
    padding: { min: 0, max: 32, integer: true },
    maxPageSize: { values: [2048, 4096] },
  },
  PHASER_ATLAS_PAGE_SIZES: [2048, 4096],
}));

import { PhaserAtlasExportOptions } from '@/features/export/components/PhaserAtlasExportOptions';

function mount(element) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(element); });
  return container;
}

const baseFrame = {
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
};

const animations = [
  { id: 'idle', name: 'Idle', duration: 1000 },
  { id: 'walk', name: 'Walk', duration: 2000 },
];

describe('PhaserAtlasExportOptions', () => {
  it('renders without crashing', () => {
    expect(() => {
      mount(<PhaserAtlasExportOptions frame={baseFrame} animations={animations} />);
    }).not.toThrow();
  });

  it('shows the baked header message', () => {
    const container = mount(<PhaserAtlasExportOptions frame={baseFrame} animations={animations} />);
    expect(container.textContent).toContain('Texture Atlas (Baked)');
    expect(container.textContent).toContain('No Phaser plugin required');
  });

  it('does not show background color option', () => {
    const container = mount(<PhaserAtlasExportOptions frame={baseFrame} animations={animations} />);
    expect(container.textContent).not.toContain('Background');
    expect(container.textContent).not.toContain('Custom color');
  });

  it('does not show single file destination', () => {
    const container = mount(<PhaserAtlasExportOptions frame={baseFrame} animations={animations} />);
    expect(container.textContent).not.toContain('Single file');
  });

  it('shows ZIP and Folder destinations', () => {
    const container = mount(<PhaserAtlasExportOptions frame={baseFrame} animations={animations} />);
    expect(container.textContent).toContain('ZIP file');
  });

  it('shows trim, loop, padding, maxPageSize controls', () => {
    const container = mount(<PhaserAtlasExportOptions frame={baseFrame} animations={animations} />);
    expect(container.textContent).toContain('Trim transparent pixels');
    expect(container.textContent).toContain('Loop animation');
    expect(container.textContent).toContain('Padding');
    expect(container.textContent).toContain('Max page size');
  });

  it('disables controls when exporting', () => {
    const container = mount(
      <PhaserAtlasExportOptions frame={{ ...baseFrame, isExporting: true }} animations={animations} />,
    );
    const triggers = container.querySelectorAll('[role="combobox"]');
    for (const trigger of triggers) {
      expect(trigger.getAttribute('data-disabled')).not.toBeNull();
    }
  });
});
