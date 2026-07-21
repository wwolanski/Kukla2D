import { createActorContext } from '@xstate/react';

import { useEditorStore } from '@/store/editorStore';
import { useProjectStore } from '@/store/projectStore';

import { resolveEditorCommands } from '@/features/canvas/domain/resolveEditorCommands.js';

import { editorWorkflowMachine } from './editorWorkflowMachine.js';
import { executeCommandBatch } from './workflowCommandRuntime.js';

const editorWorkflowLogic = editorWorkflowMachine.provide({
  actions: {
    emitCommands: ({ context, event }) => {
      const commands = resolveEditorCommands({ event, context });
      if (commands.length === 0) return;
      executeCommandBatch(commands, {
        editorStore: useEditorStore,
        projectStore: useProjectStore,
        pixiRuntime: null,
        editorMode: useEditorStore.getState().editorMode,
      });
    },
  },
});

export const EditorWorkflowContext = createActorContext(editorWorkflowLogic);
