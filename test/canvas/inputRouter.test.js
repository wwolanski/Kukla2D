import { describe, it, expect } from 'vitest';
import { routePointerDown } from '@/features/canvas/domain/inputRouter.js';

const baseInput = {
  button: 0,
  altKey: false,
  ctrlKey: false,
  worldX: 0, worldY: 0,
  editorState: { activeTool: 'select', selectionTarget: 'element', toolMode: 'select', meshEditMode: false, weightPaintMode: false, showSkeleton: false, riggingMode: 'off', selection: [] },
  hasArmature: false,
  alphaHit: null,
  toolMode: 'select',
  meshEditMode: false,
  weightPaintMode: false,
};

describe('routePointerDown', () => {
  it('middle/right button → startPan', () => {
    expect(routePointerDown({ ...baseInput, button: 1 }).type).toBe('startPan');
    expect(routePointerDown({ ...baseInput, button: 2 }).type).toBe('startPan');
  });

  it('alt + left remains available for selection after Alt cycles target', () => {
    expect(routePointerDown({ ...baseInput, button: 0, altKey: true }).type).toBe('clearSelection');
  });

  it('ctrl + middle/right → startDragZoom', () => {
    expect(routePointerDown({ ...baseInput, button: 1, ctrlKey: true }).type).toBe('startDragZoom');
    expect(routePointerDown({ ...baseInput, button: 2, ctrlKey: true }).type).toBe('startDragZoom');
  });

  it('rig selection target disables canvas alpha picking', () => {
    const result = routePointerDown({
      ...baseInput,
      editorState: { ...baseInput.editorState, selectionTarget: 'rig', showSkeleton: true, riggingMode: 'bones' },
      hasArmature: true,
      alphaHit: 'part1',
    });
    expect(result.type).toBe('clearSelection');
  });

  it('rig selection target never returns selectPart (even with alpha hit)', () => {
    const result = routePointerDown({
      ...baseInput,
      editorState: { ...baseInput.editorState, selectionTarget: 'rig', showSkeleton: true, riggingMode: 'bones' },
      alphaHit: 'part1',
    });
    expect(result.type).not.toBe('selectPart');
    expect(result.type).toBe('clearSelection');
  });

  it('rig selection target with no alpha hit still clears', () => {
    const result = routePointerDown({
      ...baseInput,
      editorState: { ...baseInput.editorState, selectionTarget: 'rig', showSkeleton: true, riggingMode: 'bones' },
    });
    expect(result.type).toBe('clearSelection');
  });

  it('element selection target allows normal alpha picking with visible skeleton', () => {
    const result = routePointerDown({
      ...baseInput,
      editorState: { ...baseInput.editorState, showSkeleton: true, riggingMode: 'bones' },
      hasArmature: true,
      alphaHit: 'part1',
    });
    expect(result.type).toBe('selectPart');
  });

  it('mesh edit selected part has priority over alpha picking', () => {
    const result = routePointerDown({
      ...baseInput,
      meshEditMode: true,
      editorState: { ...baseInput.editorState, meshEditMode: true, selection: ['part1'] },
      alphaHit: 'part2',
      toolMode: 'add_vertex',
    });
    expect(result.type).toBe('meshEditAddVertex');
  });

  it('weight paint when selected and weightPaintMode', () => {
    const result = routePointerDown({
      ...baseInput,
      weightPaintMode: true,
      editorState: { ...baseInput.editorState, weightPaintMode: true, selection: ['part1'] },
    });
    expect(result.type).toBe('startWeightPaint');
  });

  it('alpha hit → selectPart', () => {
    const result = routePointerDown({ ...baseInput, alphaHit: 'p1' });
    expect(result.type).toBe('selectPart');
    expect(result.partId).toBe('p1');
  });

  it('no alpha hit → clearSelection', () => {
    expect(routePointerDown({ ...baseInput }).type).toBe('clearSelection');
  });

  it('draw bone tool', () => {
    const result = routePointerDown({
      ...baseInput,
      editorState: { ...baseInput.editorState, activeTool: 'drawBone', toolMode: 'draw_bone' },
    });
    expect(result.type).toBe('startDrawBone');
  });

  it('drawIk tool returns clearSelection', () => {
    const result = routePointerDown({
      ...baseInput,
      editorState: { ...baseInput.editorState, activeTool: 'drawIk' },
      alphaHit: 'part1',
    });
    expect(result.type).toBe('clearSelection');
  });

  it('mesh edit with deform toolMode returns startBrushDrag', () => {
    const result = routePointerDown({
      ...baseInput,
      meshEditMode: true,
      editorState: { ...baseInput.editorState, meshEditMode: true, selection: ['part1'] },
      toolMode: 'deform',
    });
    expect(result.type).toBe('startBrushDrag');
  });

  it('mesh edit with move toolMode returns startBrushDrag', () => {
    const result = routePointerDown({
      ...baseInput,
      meshEditMode: true,
      editorState: { ...baseInput.editorState, meshEditMode: true, selection: ['part1'] },
      toolMode: 'move',
    });
    expect(result.type).toBe('startBrushDrag');
  });

  it('mesh edit with remove_vertex toolMode returns meshEditRemoveVertex', () => {
    const result = routePointerDown({
      ...baseInput,
      meshEditMode: true,
      editorState: { ...baseInput.editorState, meshEditMode: true, selection: ['part1'] },
      toolMode: 'remove_vertex',
    });
    expect(result.type).toBe('meshEditRemoveVertex');
  });

  it('mesh edit with default toolMode returns startVertexDrag', () => {
    const result = routePointerDown({
      ...baseInput,
      meshEditMode: true,
      editorState: { ...baseInput.editorState, meshEditMode: true, selection: ['part1'] },
      toolMode: 'select',
    });
    expect(result.type).toBe('startVertexDrag');
  });

  it('mesh edit without selection falls through to alpha picking', () => {
    const result = routePointerDown({
      ...baseInput,
      meshEditMode: true,
      editorState: { ...baseInput.editorState, meshEditMode: true, selection: [] },
      alphaHit: 'part1',
    });
    expect(result.type).toBe('selectPart');
  });

  it('weight paint without selection falls through to alpha picking', () => {
    const result = routePointerDown({
      ...baseInput,
      weightPaintMode: true,
      editorState: { ...baseInput.editorState, weightPaintMode: true, selection: [] },
      alphaHit: 'part1',
    });
    expect(result.type).toBe('selectPart');
  });
});

describe('routePointerDown purity', () => {
  it('does not mutate input', () => {
    const input = {
      ...baseInput,
      editorState: { ...baseInput.editorState },
    };
    const frozen = Object.freeze(input);
    const frozenEditorState = Object.freeze(input.editorState);
    expect(() => routePointerDown(frozen)).not.toThrow();
    expect(() => routePointerDown({ ...frozen, editorState: frozenEditorState })).not.toThrow();
  });

  it('returns a plain object with type property', () => {
    const result = routePointerDown(baseInput);
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
    expect(typeof result.type).toBe('string');
  });

  it('does not import store or DOM modules', async () => {
    const mod = await import('@/features/canvas/domain/inputRouter.js');
    const src = String(mod.routePointerDown);
    expect(src).not.toContain('useEditorStore');
    expect(src).not.toContain('useProjectStore');
    expect(src).not.toContain('document');
    expect(src).not.toContain('window');
  });
});
