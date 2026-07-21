import type { Bone, Mesh, Node, ProjectDocument, Vertex } from '@kukla2d/contracts';

import type { PoseOverrides } from '@/domain/animationEngine';

import type { PixiPerformanceCounters } from '@/features/canvas/domain/pixiPerformanceMetrics.js';
import type { EditorCommand, ProjectMutator, WorkflowEditorInteraction, WorkflowEvent } from '@/features/canvas/domain/workflowContracts.js';

import type { CanvasAnimationRuntimePort, CanvasDraftPoseValue } from '../rendererTypes.js';
import type { PixiViewportBridge } from './PixiViewportBridge.js';
import type { Container } from 'pixi.js';
import type { RefObject } from 'react';

export interface WorkflowActor {
  send(event: WorkflowEvent): unknown;
}

export interface EditorRuntimePort {
  activeTool?: string;
  toolMode?: string;
  riggingTool?: string;
  selection: string[];
  selectionTarget?: 'all' | 'element' | 'rig';
  rigSelectionAnchor: string | null;
  activeBoneId: string | null;
  activeConstraintId: string | null;
  activeBlendShapeId: string | null;
  exportAreaMoveMode: boolean;
  interaction: WorkflowEditorInteraction | null;
  view: { zoom: number; panX: number; panY: number };
  weightPaintMode?: boolean;
  weightPaintBoneId: string | null;
  weightPaintStrength: number;
  weightPaintBrushMode: 'add' | 'subtract' | 'replace' | 'smooth';
  weightPaintTargetValue: number;
  brushSize: number;
  brushHardness: number;
  meshEditMode?: boolean;
  meshSubMode?: string;
  blendShapeEditMode: boolean;
  skeletonEditMode: boolean;
  drawBoneChainMode: boolean;
  drawBoneAutoAssign: boolean;
  drawBoneAutoAssignMode: 'smart' | 'classic';
  editorMode: 'staging' | 'animation';
  autoKeyframe: boolean;
  hoverHit: string | null;
  hoverSource: 'canvas' | 'panel' | null;
}

export interface AnimationAuthoringPort {
  beginGesture(): string;
  previewPartial(targetId: string, partial: CanvasDraftPoseValue, meta?: Record<string, unknown>): unknown;
  commitGesture(meta?: Record<string, unknown>): void;
  endGesture(): void;
  cancelGesture(): void;
}

export interface PointerInput {
  button?: number;
  clientX: number;
  clientY: number;
  altKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  global?: { x: number; y: number };
  nativeEvent?: unknown;
  originalEvent?: unknown;
  stopPropagation?(): void;
}

export interface FramePoseSnapshot {
  poseOverrides: PoseOverrides | null;
  effectiveNodes: Node[];
  effectiveBones: Bone[];
  preLinkedNodes?: Node[];
}

export interface PixiInteractionSystemOptions {
  viewportBridge: PixiViewportBridge;
  overlayLayer: Container;
  projectRef: RefObject<ProjectDocument>;
  editorRef: RefObject<EditorRuntimePort>;
  animationRef: RefObject<CanvasAnimationRuntimePort>;
  updateProject: (mutator: ProjectMutator) => void;
  setSelection: (ids: string[]) => void;
  markDirty: () => void;
  workflowActor: WorkflowActor;
  metrics?: PixiPerformanceCounters;
  imageDataByPartId?: Map<string, ImageData>;
  executeCommand: (command: EditorCommand) => void;
  uploadMesh: (partId: string, mesh: Mesh) => void;
  uploadPositions: (partId: string, vertices: Vertex[], uvs?: ArrayLike<number>) => void;
  animationAuthoringAdapter?: AnimationAuthoringPort | null;
}
