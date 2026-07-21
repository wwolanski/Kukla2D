import { animationSelectors, useAnimationStore } from '@/store/animationStore';
import type {
  AnimationActions,
  AnimationState,
  AnimationStore,
  DraftPoseValue,
} from '@/store/animationStore';
import { editorSelectors, readEditorState, useEditorStore } from '@/store/editorStore';
import type {
  EditorActions,
  EditorInteraction,
  EditorState,
  EditorStore,
} from '@/store/editorStore';

const animationStore: AnimationStore = useAnimationStore.getState();
const animationState: AnimationState = animationStore;
const animationActions: AnimationActions = animationStore;
const draftValue: DraftPoseValue = { x: 12, mesh_verts: [{ x: 0, y: 0 }] };

animationSelectors.activeAnimationId(animationStore);
animationSelectors.transport(animationStore);
animationSelectors.hasPendingDraft(animationStore);

const editorStore: EditorStore = readEditorState();
const editorState: EditorState = useEditorStore.getState();
const editorActions: EditorActions = editorStore;
const interaction: EditorInteraction = {
  kind: 'pendingPickAutoMotionPoint',
  role: 'cheekArea',
  targetNodeId: null,
};

editorSelectors.selection(editorStore);
editorSelectors.interaction(editorStore);
editorSelectors.view(editorStore);
void [animationState, animationActions, draftValue, editorState, editorActions, interaction];
