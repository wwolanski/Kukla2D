// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { useEditorStore } from '@/store/editorStore';

vi.mock('@/app/providers/theme/useTheme.js', () => ({
  useTheme: () => ({ themeMode: 'dark', osTheme: 'dark' }),
}));

import CanvasSurface from '@/features/canvas/components/CanvasSurface';

function renderInto(node, element) {
  const root = createRoot(node);
  act(() => { root.render(element); });
  return root;
}

function mount(element) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  renderInto(container, element);
  return container;
}

describe('Canvas Armature button', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    useEditorStore.setState({
      showSkeleton: true,
      skeletonEditMode: false,
      editorMode: 'staging',
      overlays: { irisClipping: false },
    });
  });

  it('renders Armature toggle button next to bg-switcher', () => {
    const container = mount(
      <CanvasSurface
        canvasRef={{ current: null }}
        handlers={{}}
        toolCursor="default"
        editorState={{}}
        showSkeleton={true}
        onToggleArmature={() => {}}
      />
    );
    const btn = container.querySelector('button[aria-label="Toggle armature overlays"]');
    expect(btn).toBeTruthy();
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('calls onToggleArmature when clicked', () => {
    const onToggle = vi.fn();
    const container = mount(
      <CanvasSurface
        canvasRef={{ current: null }}
        handlers={{}}
        toolCursor="default"
        editorState={{}}
        showSkeleton={true}
        onToggleArmature={onToggle}
      />
    );
    const btn = container.querySelector('button[aria-label="Toggle armature overlays"]');
    act(() => { btn.click(); });
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('shows inactive state when showSkeleton is false', () => {
    const container = mount(
      <CanvasSurface
        canvasRef={{ current: null }}
        handlers={{}}
        toolCursor="default"
        editorState={{}}
        showSkeleton={false}
        onToggleArmature={() => {}}
      />
    );
    const btn = container.querySelector('button[aria-label="Toggle armature overlays"]');
    expect(btn.getAttribute('aria-pressed')).toBe('false');
  });

  it('renders and triggers Export Area visibility beside Armature', () => {
    const onToggleExportArea = vi.fn();
    const container = mount(
      <CanvasSurface
        canvasRef={{ current: null }}
        handlers={{}}
        toolCursor="default"
        editorState={{}}
        showExportArea={false}
        onToggleExportArea={onToggleExportArea}
      />
    );
    const btn = container.querySelector('button[aria-label="Toggle export area"]');
    expect(btn).toBeTruthy();
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    expect(btn.textContent).toContain('Show Export Area');
    act(() => { btn.click(); });
    expect(onToggleExportArea).toHaveBeenCalledOnce();
  });
});
