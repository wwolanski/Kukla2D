// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { useLayerPanelBoneTreeDnD } from '@/features/layers/application/useLayerPanelBoneTreeDnD';
import { useLayerPanelDepthDnD } from '@/features/layers/application/useLayerPanelDepthDnD';
import { useLayerPanelSelection } from '@/features/layers/application/useLayerPanelSelection';
import { act, renderHook } from '../renderHook.jsx';

function applyProjectRecipe(project, recipe) {
  recipe(project);
}

describe('LayerPanel application hooks', () => {
  it('reorders depth rows through the supplied project mutation boundary', () => {
    const project = {
      nodes: [
        { id: 'front', type: 'part', draw_order: 2 },
        { id: 'middle', type: 'part', draw_order: 1 },
        { id: 'back', type: 'part', draw_order: 0 },
      ],
    };
    const updateProject = vi.fn(recipe => applyProjectRecipe(project, recipe));
    const { result } = renderHook(() => useLayerPanelDepthDnD({
      nodes: project.nodes,
      selection: [],
      updateProject,
      deleteNode: vi.fn(),
      setSelection: vi.fn(),
    }));

    act(() => {
      result.current.onDragStart({ dataTransfer: { setDragImage: vi.fn() } }, 'front');
      result.current.onDrop('back');
    });

    expect(updateProject).toHaveBeenCalledOnce();
    expect(project.nodes.map(node => [node.id, node.draw_order])).toEqual([
      ['front', 1],
      ['middle', 2],
      ['back', 0],
    ]);
  });

  it('routes node selection through editor and workflow boundaries', () => {
    const setSelection = vi.fn();
    const setShowSkeleton = vi.fn();
    const send = vi.fn();
    const { result } = renderHook(() => useLayerPanelSelection({
      bones: [],
      nodes: [{ id: 'part-1', type: 'part' }],
      boneTreeRows: [],
      selection: [],
      updateProject: vi.fn(),
      setSelection,
      setActiveBoneId: vi.fn(),
      setActiveConstraintId: vi.fn(),
      setRiggingMode: vi.fn(),
      setRiggingTool: vi.fn(),
      showSkeleton: true,
      setShowSkeleton,
      send,
      expandGroup: vi.fn(),
    }));

    act(() => {
      result.current.handleSelect('part-1');
    });

    expect(setSelection).toHaveBeenCalledWith(['part-1']);
    expect(send).toHaveBeenCalledWith({ type: 'SET_TOOL', tool: 'transform' });
    expect(setShowSkeleton).toHaveBeenCalledWith(false);
  });

  it('keeps the bone tree expansion boundary explicit', () => {
    const toggleGroupExpand = vi.fn();
    const { result } = renderHook(() => useLayerPanelBoneTreeDnD({
      updateProject: vi.fn(),
      toggleGroupExpand,
      expandGroup: vi.fn(),
      handleBoneSelect: vi.fn(),
    }));

    act(() => {
      result.current.toggleExpand('bone:root');
    });

    expect(toggleGroupExpand).toHaveBeenCalledWith('bone:root');
  });
});
