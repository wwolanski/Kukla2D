import { create } from 'zustand';

import { createEmptyProject } from '@/core/createEmptyProject';

import {
  composeProjectCapabilities,
  createProjectAnimationCommands,
  createProjectBaseCommands,
  createProjectBlendShapeCommands,
  createProjectControlMotionCommands,
  createProjectLifecycleCommands,
  createProjectNodeHierarchyCommands,
  createProjectPhysicsRuleCommands,
} from '@/store/project/projectCapabilityCreators';
import type { ProjectStore } from '@/store/project/projectStoreTypes';

export { DEFAULT_TRANSFORM, prepareLoadedProjectState } from '@/store/project/projectStoreShared';
export { projectSelectors } from '@/store/project/projectStoreTypes';
export type {
  ProjectActions,
  ProjectCommandErrorCode,
  ProjectCommandResult,
  ProjectOperationResult,
  ProjectState,
  ProjectStore,
  ProjectVersionControl,
} from '@/store/project/projectStoreTypes';

// Runtime document composition root. Capability creators preserve flat public API.
export const useProjectStore = create<ProjectStore>()((set, get) => ({
  project: createEmptyProject(),
  versionControl: {
    geometryVersion: 0,
    transformVersion: 0,
    textureVersion: 0,
  },
  hasUnsavedChanges: false,
  ...composeProjectCapabilities(
    createProjectBaseCommands(set),
    createProjectNodeHierarchyCommands(set, get),
    createProjectAnimationCommands(set, get),
    createProjectPhysicsRuleCommands(set),
    createProjectBlendShapeCommands(set),
    createProjectControlMotionCommands(set, get),
    createProjectLifecycleCommands(set, get),
  ),
}));
