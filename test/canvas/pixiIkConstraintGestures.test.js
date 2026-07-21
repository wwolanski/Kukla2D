import { describe, expect, it, vi } from 'vitest';
import { handleIkPointerDown } from '@/features/canvas/infrastructure/rendering/pixi/PixiIkConstraintGestures.js';

function createAdapter(project) {
  const editor = {
    activeTool: 'drawIk',
    editorMode: 'staging',
    interaction: { kind: 'idle' },
    view: { zoom: 1 },
  };
  return {
    projectRef: { current: project },
    editorRef: { current: editor },
    _executeCommand: vi.fn(command => {
      if (command.type === 'updateProject') command.payload.mutator(project);
      if (command.type === 'setInteraction') editor.interaction = command.payload.interaction;
    }),
    markDirty: vi.fn(),
  };
}

describe('Pixi IK constraint gestures', () => {
  it('does not create an IK target when no bones exist', () => {
    const project = { bones: [], constraints: [] };
    const adapter = createAdapter(project);

    expect(handleIkPointerDown(adapter, { x: 10, y: 20 })).toBe(true);
    expect(project.constraints).toEqual([]);
    expect(adapter.editorRef.current.interaction).toMatchObject({
      kind: 'ikNotice',
    });
  });

  it('does not create an IK target when every bone chain is occupied', () => {
    const project = {
      bones: [{ id: 'bone-1', parentId: null, setup: { x: 0, y: 0, length: 20 } }],
      constraints: [{
        id: 'ik-1',
        type: 'ik',
        name: 'IK 1',
        affectedBoneIds: ['bone-1'],
      }],
    };
    const adapter = createAdapter(project);

    handleIkPointerDown(adapter, { x: 10, y: 20 });

    expect(project.constraints).toHaveLength(1);
    expect(adapter.editorRef.current.interaction.message).toContain('No available bone chain');
  });
});
