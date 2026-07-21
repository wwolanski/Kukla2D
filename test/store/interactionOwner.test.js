import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '@/store/editorStore';

describe('Interaction owner contract', () => {
  beforeEach(() => {
    useEditorStore.setState({
      interactionOwner: null,
      selection: [],
      activeBoneId: null,
      activeConstraintId: null,
    });
  });

  it('defaults to null', () => {
    expect(useEditorStore.getState().interactionOwner).toBeNull();
  });

  it('setInteractionOwner sets canvas', () => {
    useEditorStore.getState().setInteractionOwner('canvas');
    expect(useEditorStore.getState().interactionOwner).toBe('canvas');
  });

  it('setInteractionOwner sets timeline', () => {
    useEditorStore.getState().setInteractionOwner('timeline');
    expect(useEditorStore.getState().interactionOwner).toBe('timeline');
  });

  it('setInteractionOwner overwrites previous owner', () => {
    useEditorStore.getState().setInteractionOwner('canvas');
    useEditorStore.getState().setInteractionOwner('timeline');
    expect(useEditorStore.getState().interactionOwner).toBe('timeline');
  });

  it('clearInteractionOwner clears only when matching', () => {
    useEditorStore.getState().setInteractionOwner('canvas');
    useEditorStore.getState().clearInteractionOwner('timeline');
    expect(useEditorStore.getState().interactionOwner).toBe('canvas');
  });

  it('clearInteractionOwner clears when matching', () => {
    useEditorStore.getState().setInteractionOwner('canvas');
    useEditorStore.getState().clearInteractionOwner('canvas');
    expect(useEditorStore.getState().interactionOwner).toBeNull();
  });

  it('clearInteractionOwner is no-op when already null', () => {
    useEditorStore.getState().clearInteractionOwner('canvas');
    expect(useEditorStore.getState().interactionOwner).toBeNull();
  });
});
