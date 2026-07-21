import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SHORTCUT_FILE = resolve(import.meta.dirname, '../../src/features/canvas/application/useCanvasKeyboardShortcuts.ts');
const SOURCE = readFileSync(SHORTCUT_FILE, 'utf-8');

describe('animation shortcut boundary', () => {
  it('does not import raw animation engine functions directly', () => {
    expect(SOURCE).not.toMatch(/import.*upsertKeyframe.*from/);
    expect(SOURCE).not.toMatch(/import.*computePoseOverrides.*from/);
    expect(SOURCE).not.toMatch(/import.*KEYFRAME_PROPS.*from/);
  });

  it('does not call updateProject with inline animation recipe', () => {
    expect(SOURCE).not.toMatch(/updateProject\(\(p\) =>\s*\{/);
  });

  it('does not use upsertKeyframe directly', () => {
    expect(SOURCE).not.toMatch(/upsertKeyframe\(/);
  });

  it('does not construct tracks manually', () => {
    expect(SOURCE).not.toMatch(/animation\.tracks\.push/);
    expect(SOURCE).not.toMatch(/track\.keyframes\.push/);
  });

  it('uses the authoring API for K key', () => {
    expect(SOURCE).toMatch(/createAnimationAuthoringApi/);
    expect(SOURCE).toMatch(/authoringApi\.keySelected/);
  });

  it('does not use J-skinning expansion for K', () => {
    expect(SOURCE).not.toMatch(/JSKinningRoles/);
    expect(SOURCE).not.toMatch(/jointBoneId/);
  });

  it('does not expand pose draft bones for clean K', () => {
    expect(SOURCE).not.toMatch(/activeTool === 'pose'/);
    expect(SOURCE).not.toMatch(/draftPose.*filter.*bones/);
  });

  it('still adds active constraint to K selection', () => {
    expect(SOURCE).toMatch(/activeConstraintId/);
  });

  it('does not dispatch synthetic KeyboardEvent', () => {
    expect(SOURCE).not.toMatch(/new\s+KeyboardEvent/);
    expect(SOURCE).not.toMatch(/dispatchEvent.*new.*Event/);
  });

  it('does not import from @/domain/animationEngine', () => {
    expect(SOURCE).not.toMatch(/from ['"]@\/domain\/animationEngine/);
  });
});
