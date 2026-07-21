import { useEditorStore } from '@/store/editorStore';
import type { EditorStore } from '@/store/editorStoreTypes';
import { useProjectStore } from '@/store/projectStore';

import type { EditorCommand } from '@/features/canvas/domain/workflowContracts.js';

import { executeCommand } from './workflowCommandRuntime.js';

import type { PixiRuntime } from './workflowCommandRuntime.js';
import type { RefObject } from 'react';


export function createCanvasCommandExecutor({ gateway, editorRef }: { gateway: PixiRuntime | null; editorRef: RefObject<Pick<EditorStore, 'editorMode'>> }): (command: EditorCommand) => void {
  return (command) => executeCommand(command, {
    editorStore: useEditorStore,
    projectStore: useProjectStore,
    pixiRuntime: gateway,
    editorMode: editorRef.current?.editorMode,
  });
}
