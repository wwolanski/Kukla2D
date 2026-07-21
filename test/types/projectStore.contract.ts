import { projectSelectors } from '@/store/projectStore';
import type {
  ProjectActions,
  ProjectCommandErrorCode,
  ProjectCommandResult,
  ProjectOperationResult,
  ProjectState,
  ProjectStore,
  ProjectVersionControl,
} from '@/store/projectStore';

declare const store: ProjectStore;

const state: ProjectState = store;
const actions: ProjectActions = store;
const versions: ProjectVersionControl = projectSelectors.versionControl(store);
const commandResult: ProjectCommandResult = { changed: false, affectedIds: [] };
const errorCode: ProjectCommandErrorCode = 'not-found';
const operationResult: ProjectOperationResult = { changed: false, error: 'Missing target', errorCode };

projectSelectors.project(store);
projectSelectors.nodes(store);
projectSelectors.animations(store);
void [state, actions, versions, commandResult, operationResult];
