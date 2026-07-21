// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

const mockRegistry = vi.hoisted(() => ({
  listExportTypes: vi.fn(() => [
    { id: 'sequence', label: 'Image sequence', status: 'active' },
    { id: 'spritesheet', label: 'Spritesheet', status: 'active' },
    { id: 'animation', label: 'Animated image', status: 'active' },
    { id: 'spine', label: 'Spine 2D', status: 'unactive' },
  ]),
  listExportFormats: vi.fn(type => type === 'animation'
    ? [{ format: 'gif', formatLabel: 'GIF' }]
    : [{ format: 'png', formatLabel: 'PNG' }]),
}));

vi.mock('@/features/export/domain/exportVariantRegistry', () => mockRegistry);

import { ExportTypeOptions } from '@/features/export/components/ExportTypeOptions';

function mount(element) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(element); });
  return container;
}

describe('ExportTypeOptions', () => {
  it('renders without crashing with active type', () => {
    const onTypeChange = vi.fn();
    const onChange = vi.fn();
    expect(() => {
      mount(
        <ExportTypeOptions
          type="sequence"
          format="png"
          isExporting={false}
          onTypeChange={onTypeChange}
          onFormatChange={onChange}
        />
      );
    }).not.toThrow();
    expect(mockRegistry.listExportTypes).toHaveBeenCalled();
  });

  it('renders without crashing for animated image type', () => {
    const onTypeChange = vi.fn();
    const onChange = vi.fn();
    expect(() => {
      mount(
        <ExportTypeOptions
          type="animation"
          format="gif"
          isExporting={false}
          onTypeChange={onTypeChange}
          onFormatChange={onChange}
        />
      );
    }).not.toThrow();
  });

  it('calls registry selectors on render', () => {
    mockRegistry.listExportTypes.mockClear();
    mount(
      <ExportTypeOptions
        type="sequence"
        format="png"
        isExporting={false}
        onTypeChange={vi.fn()}
        onFormatChange={vi.fn()}
      />
    );
    expect(mockRegistry.listExportTypes).toHaveBeenCalled();
    expect(mockRegistry.listExportFormats).toHaveBeenCalledWith('sequence');
  });

});
