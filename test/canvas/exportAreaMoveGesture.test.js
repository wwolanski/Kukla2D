import { describe, expect, it, vi } from 'vitest';
import { handleCanvasPointerDown as onCanvasPointerDown } from '@/features/canvas/infrastructure/rendering/pixi/PixiCanvasGestures.js';
import { handleDragMove as onDragMove } from '@/features/canvas/infrastructure/rendering/pixi/PixiInputDrag.js';

function createAdapter(world = { x: 20, y: 30 }) {
  const project = {
    canvas: {
      x: 10,
      y: 20,
      width: 100,
      height: 80,
      presetId: 'custom',
      fitSource: { kind: 'staging' },
    },
    nodes: [],
    bones: [],
  };
  const adapter = {
    editorRef: { current: { exportAreaMoveMode: true, showExportArea: true } },
    projectRef: { current: project },
    _eventWorldPosition: vi.fn(() => world),
    _beginCommandBatch: vi.fn(),
    _setDragState: vi.fn(function setDragState(state) { this._dragState = state; }),
    _sendWorkflow: vi.fn(),
    _executeCommand: vi.fn(command => command.payload.mutator(project)),
    markDirty: vi.fn(),
  };
  return { adapter, project };
}

describe('Export Area move gesture', () => {
  it('starts only inside the export rectangle and moves its canonical origin', () => {
    const { adapter, project } = createAdapter();
    const event = { button: 0, stopPropagation: vi.fn() };

    onCanvasPointerDown(adapter, event);

    expect(adapter._dragState).toEqual(expect.objectContaining({
      type: 'exportAreaMove',
      startX: 10,
      startY: 20,
    }));
    expect(adapter._beginCommandBatch).toHaveBeenCalledWith({
      name: 'Move export area',
      type: 'exportArea',
    });

    adapter._eventWorldPosition.mockReturnValue({ x: 45, y: 55 });
    onDragMove(adapter, { clientX: 45, clientY: 55 });

    expect(project.canvas.x).toBe(35);
    expect(project.canvas.y).toBe(45);
    expect(project.canvas.fitSource).toBeNull();
    expect(project.canvas.presetId).toBe('custom');
  });

  it('consumes outside clicks without moving or selecting content', () => {
    const { adapter } = createAdapter({ x: -1, y: -1 });
    onCanvasPointerDown(adapter, { button: 0, stopPropagation: vi.fn() });
    expect(adapter._dragState).toBeUndefined();
    expect(adapter._beginCommandBatch).not.toHaveBeenCalled();
  });
});
