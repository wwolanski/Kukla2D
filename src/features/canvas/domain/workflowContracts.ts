import type { ProjectDocument } from '@kukla2d/contracts';

import type { GestureSession } from './gestureSession.js';
import type { Draft } from 'immer';

export interface Point2D {
  x: number;
  y: number;
}

export interface ScreenRect extends Point2D {
  w: number;
  h: number;
}

export interface ModifierState {
  altKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

export interface InteractionTarget {
  kind: string;
  id?: string;
}

export interface WorkflowFile {
  readonly name: string;
  readonly size: number;
  readonly type: string;
}

export type EditorInteractionEvent = {
  type:
    | 'pointerDown'
    | 'pointerMove'
    | 'pointerUp'
    | 'pointerCancel'
    | 'dropFiles'
    | 'dragFilesEnter'
    | 'dragFilesLeave'
    | 'keyDown'
    | 'keyUp';
  pointer: Point2D | null;
  screen: Point2D | null;
  world: Point2D | null;
  modifiers: ModifierState;
  button: number;
  target: InteractionTarget | null;
  files?: readonly WorkflowFile[];
  key?: string;
};

export type WorkflowSelectionTarget = 'all' | 'element' | 'rig';
export type WorkflowImportStatus = 'idle' | 'dragOver' | 'importing' | 'done' | 'failed';
export type GesturePayload = Record<string, unknown>;

export type WorkflowEvent =
  | { type: 'POINTER_DOWN'; intent: string; partId?: string }
  | { type: 'POINTER_UP' | 'CANCEL' | 'CYCLE_SELECTION_TARGET' | 'ENTER_MESH_EDIT' | 'EXIT_MESH_EDIT' | 'ENTER_RIG' | 'EXIT_RIG' | 'COMMIT_GESTURE' | 'CANCEL_GESTURE' | 'CLEAR_SELECTION' | 'COMMIT_MARQUEE' | 'DRAG_FILES_ENTER' | 'DRAG_FILES_LEAVE' | 'DROP_FILES' | 'IMPORT_DONE' | 'IMPORT_FAILED' | 'ENTER_WEIGHT_PAINT' | 'EXIT_WEIGHT_PAINT' }
  | { type: 'SET_TOOL'; tool: string }
  | { type: 'SET_SELECTION_TARGET'; target: WorkflowSelectionTarget }
  | { type: 'SET_RIGGING_MODE'; riggingMode: string }
  | { type: 'SET_TOOL_MODE'; toolMode: string }
  | { type: 'SET_RIGGING_TOOL'; riggingTool: string }
  | { type: 'SET_MESH_SUBMODE'; meshSubMode: string }
  | { type: 'START_PAN' | 'START_TRANSFORM_DRAG' | 'START_MESH_BRUSH' | 'START_WEIGHT_PAINT' | 'START_DRAW_BONE' | 'START_VERTEX_DRAG' | 'START_GIZMO_MOVE' | 'START_GIZMO_ROTATE' | 'START_GIZMO_PIVOT' | 'START_SKELETON_JOINT' | 'START_SKELETON_BONE' | 'START_SKELETON_TRACKPAD' | 'START_SKELETON_ROTATE'; payload?: GesturePayload }
  | { type: 'MOVE_GESTURE'; payload: GesturePayload }
  | { type: 'SELECT_HIT'; partId: string; replace?: boolean }
  | { type: 'SELECT_RIG_HIT'; boneIds: string[]; elementIds?: string[] | undefined; constraintIds?: string[] | undefined; activeBoneId: string | null; activeConstraintId?: string | null | undefined; anchor?: string | null | undefined }
  | { type: 'START_MARQUEE'; origin: Point2D; target?: WorkflowSelectionTarget; modifiers?: Partial<ModifierState> }
  | { type: 'UPDATE_MARQUEE'; box: ScreenRect };

export interface EditorWorkflowState {
  activeTool: string;
  selectionTarget: WorkflowSelectionTarget;
  lastNonRigSelectionTarget: WorkflowSelectionTarget | null;
  riggingMode: string;
  riggingTool: string;
  toolMode: string;
  meshEditMode: boolean;
  meshSubMode: string;
  weightPaintMode: boolean;
  activeSession: GestureSession | null;
  marqueeBox: ScreenRect | null;
  importStatus: WorkflowImportStatus;
}

interface ProjectVersionCounters {
  geometryVersion: number;
  transformVersion: number;
  textureVersion: number;
}

export type ProjectMutator = (project: Draft<ProjectDocument>, versionControl: Draft<ProjectVersionCounters>) => void;

export type WorkflowEditorInteraction =
  | { kind: 'idle' }
  | { kind: 'pendingAssignBone'; boneId?: string; candidateNodeIds?: string[] }
  | { kind: 'pendingPickIKBone'; constraintId: string; error?: string }
  | { kind: 'pendingSuggestIKBone'; constraintId: string; boneId: string }
  | { kind: 'ikNotice' | 'canvasNotice'; message: string }
  | { kind: 'pendingPickAutoMotionPart'; role: string }
  | { kind: 'pendingPickAutoMotionPoint'; role: string; targetNodeId: string | null }
  | { kind: 'autoMotionPickResult'; role: string; nodeId: string; localPoint: Point2D; worldPoint: Point2D };

export type EditorCommand =
  | { type: 'setSelection'; payload: { ids: string[] }; sessionId?: number }
  | { type: 'clearSelection'; payload: { target?: WorkflowSelectionTarget }; sessionId?: number }
  | { type: 'setRigSelection'; payload: { boneIds?: string[] | undefined; elementIds?: string[] | undefined; constraintIds?: string[] | undefined; activeBoneId?: string | null | undefined; activeConstraintId?: string | null | undefined; anchor?: string | null | undefined }; sessionId?: number }
  | { type: 'setMarquee'; payload: { box: ScreenRect | null }; sessionId?: number }
  | { type: 'setDrawBonePreview'; payload: { preview?: { startX: number; startY: number; endX: number; endY: number } | null }; sessionId?: number }
  | { type: 'setInteraction'; payload: { interaction?: WorkflowEditorInteraction | null }; sessionId?: number }
  | { type: 'beginBatch'; payload: { meta?: Record<string, unknown> | null }; sessionId?: number }
  | { type: 'endBatch'; payload: Record<never, never>; sessionId?: number }
  | { type: 'updateProject' | 'autoKeyframe'; payload: { mutator: ProjectMutator }; sessionId?: number }
  | { type: 'updatePixiPreview' | 'uploadPreview'; payload: { overrides: Record<string, unknown> }; sessionId?: number }
  | { type: 'uploadPixiResource'; payload: { id: string; blob: Blob }; sessionId?: number }
  | { type: 'markDirty' | 'importFiles'; payload: Record<string, unknown>; sessionId?: number }
  | { type: 'setHover'; payload: { hit?: string | null; source?: 'canvas' | 'panel' }; sessionId?: number }
  | { type: 'applyWorkflowUi'; payload: WorkflowUiPayload; sessionId?: number };

export interface WorkflowUiPayload {
  showSkeleton?: boolean;
  clearRigFocus?: boolean;
  clearSelection?: boolean;
  clearHover?: boolean;
  clearBlendShape?: boolean;
  finishExportAreaMove?: boolean;
  resetRigOverlays?: boolean;
}

export type EditorCommandType = EditorCommand['type'];
export type CacheEntryStatus = 'idle' | 'active' | 'committed' | 'cancelled';

export interface GestureComputationCacheEntry {
  sessionId: number;
  status: CacheEntryStatus;
  previewOverrides: Map<string, Record<string, unknown>> | null;
  startPositions: Map<string, Record<string, unknown>> | null;
  metadata: Record<string, unknown>;
}

const DEFAULT_MODIFIERS: Readonly<ModifierState> = Object.freeze({
  altKey: false,
  ctrlKey: false,
  shiftKey: false,
  metaKey: false,
});

export function createPointerDownEvent(pointer: Point2D | null = null, world: Point2D | null = null, screen: Point2D | null = null, modifiers: Partial<ModifierState> = {}, button = 0, target: InteractionTarget | null = null): EditorInteractionEvent {
  return { type: 'pointerDown', pointer, screen, world, modifiers: { ...DEFAULT_MODIFIERS, ...modifiers }, button, target };
}

export function createPointerMoveEvent(pointer: Point2D | null = null, world: Point2D | null = null, screen: Point2D | null = null, modifiers: Partial<ModifierState> = {}): EditorInteractionEvent {
  return { type: 'pointerMove', pointer, screen, world, modifiers: { ...DEFAULT_MODIFIERS, ...modifiers }, button: 0, target: null };
}

export function createPointerUpEvent(pointer: Point2D | null = null, world: Point2D | null = null, screen: Point2D | null = null, modifiers: Partial<ModifierState> = {}, button = 0): EditorInteractionEvent {
  return { type: 'pointerUp', pointer, screen, world, modifiers: { ...DEFAULT_MODIFIERS, ...modifiers }, button, target: null };
}

export function createPointerCancelEvent(): EditorInteractionEvent {
  return { type: 'pointerCancel', pointer: null, screen: null, world: null, modifiers: { ...DEFAULT_MODIFIERS }, button: 0, target: null };
}

export function createDropFilesEvent(files: readonly WorkflowFile[], pointer: Point2D | null = null): EditorInteractionEvent {
  return { type: 'dropFiles', pointer, screen: null, world: null, modifiers: { ...DEFAULT_MODIFIERS }, button: 0, target: null, files };
}

export function createDragFilesEnterEvent(files: readonly WorkflowFile[], pointer: Point2D | null = null): EditorInteractionEvent {
  return { type: 'dragFilesEnter', pointer, screen: null, world: null, modifiers: { ...DEFAULT_MODIFIERS }, button: 0, target: null, files };
}

export function createDragFilesLeaveEvent(): EditorInteractionEvent {
  return { type: 'dragFilesLeave', pointer: null, screen: null, world: null, modifiers: { ...DEFAULT_MODIFIERS }, button: 0, target: null };
}

export function createKeyDownEvent(key: string, modifiers: Partial<ModifierState> = {}): EditorInteractionEvent {
  return { type: 'keyDown', pointer: null, screen: null, world: null, modifiers: { ...DEFAULT_MODIFIERS, ...modifiers }, button: 0, target: null, key };
}

export function createEditorCommand(type: 'clearSelection', payload?: Extract<EditorCommand, { type: 'clearSelection' }>['payload'], sessionId?: number): Extract<EditorCommand, { type: 'clearSelection' }>;
export function createEditorCommand<T extends EditorCommandType>(type: T, payload: Extract<EditorCommand, { type: T }>['payload'], sessionId?: number): Extract<EditorCommand, { type: T }>;
export function createEditorCommand(type: EditorCommandType, payload: unknown = {}, sessionId?: number): EditorCommand {
  return { type, payload, ...(sessionId === undefined ? {} : { sessionId }) } as EditorCommand;
}

export function createGestureComputationCacheEntry(sessionId: number): GestureComputationCacheEntry {
  return { sessionId, status: 'active', previewOverrides: null, startPositions: null, metadata: {} };
}

export function updateGestureCacheEntry(entry: GestureComputationCacheEntry, patch: Partial<Pick<GestureComputationCacheEntry, 'status' | 'previewOverrides' | 'startPositions' | 'metadata'>>): GestureComputationCacheEntry {
  return {
    ...entry,
    ...(patch.status === undefined ? {} : { status: patch.status }),
    ...(patch.previewOverrides === undefined ? {} : { previewOverrides: patch.previewOverrides }),
    ...(patch.startPositions === undefined ? {} : { startPositions: patch.startPositions }),
    ...(patch.metadata === undefined ? {} : { metadata: { ...entry.metadata, ...patch.metadata } }),
  };
}
