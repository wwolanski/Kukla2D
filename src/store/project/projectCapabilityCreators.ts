import { createProjectAnimationCommands } from './projectAnimationCommands.js';
import { createProjectBaseCommands } from './projectBaseCommands.js';
import { createProjectBlendShapeCommands } from './projectBlendShapeCommands.js';
import { createProjectControlMotionCommands } from './projectControlMotionCommands.js';
import { createProjectLifecycleCommands } from './projectLifecycleCommands.js';
import { createProjectNodeHierarchyCommands } from './projectNodeHierarchyCommands.js';
import { createProjectPhysicsRuleCommands } from './projectPhysicsRuleCommands.js';

import type { ProjectActions } from './projectStoreTypes.js';

type ProjectCapability = Partial<ProjectActions>;

export function composeProjectCapabilities(...capabilities: ProjectCapability[]): ProjectActions {
  const composed: ProjectCapability = {};
  for (const capability of capabilities) {
    for (const [methodName, method] of Object.entries(capability)) {
      if (methodName in composed) {
        throw new Error(`Duplicate project store capability method: ${methodName}`);
      }
      Object.assign(composed, { [methodName]: method });
    }
  }
  return composed as ProjectActions;
}

export {
  createProjectBaseCommands,
  createProjectAnimationCommands,
  createProjectPhysicsRuleCommands,
  createProjectBlendShapeCommands,
  createProjectControlMotionCommands,
  createProjectLifecycleCommands,
  createProjectNodeHierarchyCommands,
};
