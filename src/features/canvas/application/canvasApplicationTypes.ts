import type { Node, ProjectDocument } from '@kukla2d/contracts';

import type { AnimationStore } from '@/store/animationStoreTypes';
import type { EditorStore } from '@/store/editorStoreTypes';
import type { ProjectVersionControl } from '@/store/project/projectStoreTypes';

import type { editorWorkflowMachine } from './editorWorkflowMachine.js';
import type { ResourceRegistry, SceneGatewayLoadPort } from './workspaceLoadTransaction.js';
import type { EditorWorkflowState } from '../domain/workflowContracts.js';
import type {
  CanvasSceneGateway as RendererCanvasSceneGateway,
  CanvasViewportBridge,
  EditorView,
} from '../infrastructure/rendering/rendererTypes.js';
import type { RefObject } from 'react';
import type { ActorRefFrom } from 'xstate';

export type CanvasEditorSnapshot = EditorStore & Partial<EditorWorkflowState>;
type WorkflowActorRef = ActorRefFrom<typeof editorWorkflowMachine>;
export type MutableRef<T> = RefObject<T>;

export type ViewportBridge = CanvasViewportBridge;

interface CanvasFramePoseSnapshot {
  effectiveNodes: Node[];
}

interface CanvasInteractionSystem {
  readFramePose?: () => CanvasFramePoseSnapshot | null;
  readPreviewPoseOverrides?: () => Map<string, Record<string, unknown>> | null;
}

export interface CanvasSceneGateway extends Omit<RendererCanvasSceneGateway, 'createStagedResources' | 'swapResources'>, SceneGatewayLoadPort {
  interactionSystem?: CanvasInteractionSystem | null;
  overlayLayer?: { visible: boolean } | null;
  resources?: ResourceRegistry | null;
  uploadResource?: (id: string, blob: Blob) => void;
  updatePreview?: (overrides: Record<string, unknown>) => void;
}

export interface CanvasFrameRenderOptions {
  exportMode?: boolean;
  skipResize?: boolean;
  animationStateOverride?: AnimationStore;
  editorStateOverride?: CanvasEditorSnapshot;
  includeTransientPose?: boolean;
  viewOverride?: EditorView;
}

export type CaptureCanvasFrame = (options?: CanvasFrameRenderOptions) => void;

export interface CanvasTextureCache {
  __internal: {
    imageDataByPartId: Map<string, ImageData>;
    lastUploadedSources: Map<string, string>;
  };
}

export interface CanvasFrameSubscriptionRefs {
  projectRef: MutableRef<ProjectDocument>;
  editorRef: MutableRef<CanvasEditorSnapshot>;
  animationRef: MutableRef<AnimationStore>;
  workflowActorRef: WorkflowActorRef;
  markDirty: () => void;
}

export interface CanvasGpuSyncArgs {
  sceneGatewayRef: MutableRef<CanvasSceneGateway | null>;
  projectRef: MutableRef<ProjectDocument>;
  textureCache: CanvasTextureCache;
  isDirtyRef: MutableRef<boolean>;
  project: ProjectDocument;
  versionControl: ProjectVersionControl;
}
