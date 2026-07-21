import type { PhysicsRule } from '@kukla2d/contracts';

export interface PhysicsRuleEntry {
  groupName: string;
  category: string;
  requireTag?: string | null;
  rules: PhysicsRule[];
}

export const PHYSICS_RULES: PhysicsRuleEntry[];
