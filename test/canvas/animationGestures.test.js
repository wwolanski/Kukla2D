import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const FILES = {
  transformDrag: readFileSync(resolve(import.meta.dirname, '../../src/features/canvas/infrastructure/rendering/pixi/PixiInputTransformDrag.ts'), 'utf-8'),
  poseGestures: readFileSync(resolve(import.meta.dirname, '../../src/features/canvas/infrastructure/rendering/pixi/PixiPoseGestures.ts'), 'utf-8'),
  meshGestures: readFileSync(resolve(import.meta.dirname, '../../src/features/canvas/infrastructure/rendering/pixi/PixiMeshGestures.ts'), 'utf-8'),
  inputDrag: readFileSync(resolve(import.meta.dirname, '../../src/features/canvas/infrastructure/rendering/pixi/PixiInputDrag.ts'), 'utf-8'),
  canvasGestures: readFileSync(resolve(import.meta.dirname, '../../src/features/canvas/infrastructure/rendering/pixi/PixiCanvasGestures.ts'), 'utf-8'),
  interactionSystem: readFileSync(resolve(import.meta.dirname, '../../src/features/canvas/infrastructure/rendering/pixi/PixiInteractionSystem.ts'), 'utf-8'),
  gestureSnapshot: readFileSync(resolve(import.meta.dirname, '../../src/features/canvas/infrastructure/rendering/pixi/pixiGestureSnapshot.ts'), 'utf-8'),
  adapter: readFileSync(resolve(import.meta.dirname, '../../src/features/canvas/application/createCanvasAuthoringAdapter.ts'), 'utf-8'),
  posePreview: readFileSync(resolve(import.meta.dirname, '../../src/features/canvas/infrastructure/rendering/pixi/PixiPosePreview.ts'), 'utf-8'),
};

describe('canvas gesture adapter boundary', () => {
  it('adapter is created in application layer, not Pixi infrastructure', () => {
    expect(FILES.adapter).toContain('createAnimationAuthoringApi');
    expect(FILES.adapter).toContain('useAnimationStore');
    expect(FILES.adapter).toContain('useEditorStore');
    expect(FILES.adapter).toContain('isAuthorableProperty');
  });

  it('adapter exposes previewPartial, commitGesture, cancelGesture', () => {
    expect(FILES.adapter).toMatch(/previewPartial/);
    expect(FILES.adapter).toMatch(/commitGesture/);
    expect(FILES.adapter).toMatch(/cancelGesture/);
  });

  it('adapter previewPartial iterates properties and calls api.preview', () => {
    expect(FILES.adapter).toMatch(/Object\.entries\(partial\)/);
    expect(FILES.adapter).toMatch(/for.*entries/);
    expect(FILES.adapter).toMatch(/api\.preview/);
  });
});

describe('animation gesture handlers use authoring adapter', () => {
  it('PixiInputTransformDrag uses adapter for move in animation mode', () => {
    expect(FILES.transformDrag).toMatch(/previewPosePartial/);
    expect(FILES.posePreview).toMatch(/animationAuthoringAdapter.*previewPartial/);
  });

  it('PixiInputTransformDrag uses adapter for rotate in animation mode', () => {
    expect(FILES.transformDrag).toMatch(/previewPosePartial/);
  });

  it('PixiInputTransformDrag uses adapter for resize in animation mode', () => {
    expect(FILES.transformDrag).toMatch(/previewPosePartial/);
  });

  it('PixiPoseGestures uses adapter for bone pose branch', () => {
    expect(FILES.poseGestures).toMatch(/previewPosePartial/);
  });

  it('PixiMeshGestures uses adapter for mesh deform in animation mode', () => {
    expect(FILES.meshGestures).toMatch(/animationAuthoringAdapter/);
    expect(FILES.meshGestures).toMatch(/previewPartial/);
  });

  it('PixiMeshGestures validates vertex count before preview', () => {
    expect(FILES.meshGestures).toMatch(/vertices\.length.*verticesSnap\.length|verticesSnap\.length.*vertices\.length/);
  });

  it('PixiInputDrag uses adapter for IK move in animation mode', () => {
    expect(FILES.inputDrag).toMatch(/previewPosePartial/);
  });

  it('PixiInputDrag uses adapter for warp in animation mode', () => {
    expect(FILES.inputDrag).toMatch(/previewPosePartial/);
  });

  it('PixiInputDrag onDragEnd commits via adapter when auto-key is on', () => {
    expect(FILES.inputDrag).toMatch(/animationAuthoringAdapter.*commitGesture|commitGesture.*animationAuthoringAdapter/);
    expect(FILES.inputDrag).toMatch(/autoKeyframe/);
  });

  it('PixiCanvasGestures commits meshBrush via adapter in animation mode', () => {
    expect(FILES.canvasGestures).toMatch(/animationAuthoringAdapter.*commitGesture|commitGesture.*animationAuthoringAdapter/);
  });

  it('PixiCanvasGestures cancel calls adapter cancelGesture in animation mode', () => {
    expect(FILES.canvasGestures).toMatch(/animationAuthoringAdapter.*cancelGesture|cancelGesture.*animationAuthoringAdapter/);
  });
});

describe('PixiInteractionSystem gesture lifecycle', () => {
  it('stores animationAuthoringAdapter reference', () => {
    expect(FILES.interactionSystem).toMatch(/animationAuthoringAdapter/);
  });

  it('captures draft context/dirty/revision in gesture snapshot', () => {
    expect(FILES.gestureSnapshot).toMatch(/draftContextSnapshot/);
    expect(FILES.gestureSnapshot).toMatch(/draftDirtySnapshot/);
    expect(FILES.gestureSnapshot).toMatch(/draftRevisionSnapshot/);
  });

  it('restores draft context/dirty/revision on cancel', () => {
    expect(FILES.gestureSnapshot).toMatch(/setDraftContext.*draftContextSnapshot/);
    expect(FILES.gestureSnapshot).toMatch(/restoreDraftMetadata[\s\S]*draftDirtySnapshot[\s\S]*draftRevisionSnapshot/);
  });

  it('_cancelGesture calls adapter cancelGesture', () => {
    expect(FILES.interactionSystem).toMatch(/animationAuthoringAdapter\.cancelGesture/);
  });
});

describe('Pixi infrastructure does not import stores', () => {
  it('PixiInputTransformDrag has no store imports', () => {
    expect(FILES.transformDrag).not.toMatch(/from ['"]@\/store\//);
    expect(FILES.transformDrag).not.toMatch(/useAnimationStore/);
    expect(FILES.transformDrag).not.toMatch(/useProjectStore/);
  });

  it('PixiPoseGestures has no store imports', () => {
    expect(FILES.poseGestures).not.toMatch(/from ['"]@\/store\//);
    expect(FILES.poseGestures).not.toMatch(/useAnimationStore/);
  });

  it('PixiMeshGestures has no store imports', () => {
    expect(FILES.meshGestures).not.toMatch(/from ['"]@\/store\//);
    expect(FILES.meshGestures).not.toMatch(/useAnimationStore/);
  });

  it('PixiInputDrag has no store imports', () => {
    expect(FILES.inputDrag).not.toMatch(/from ['"]@\/store\//);
    expect(FILES.inputDrag).not.toMatch(/useAnimationStore/);
  });

  it('PixiCanvasGestures has no store imports', () => {
    expect(FILES.canvasGestures).not.toMatch(/from ['"]@\/store\//);
    expect(FILES.canvasGestures).not.toMatch(/useAnimationStore/);
  });

  it('PixiInteractionSystem has no store imports', () => {
    expect(FILES.interactionSystem).not.toMatch(/from ['"]@\/store\//);
    expect(FILES.interactionSystem).not.toMatch(/useAnimationStore/);
  });
});

describe('animation gesture does not use raw recipe', () => {
  it('no direct upsertKeyframe in gesture handlers', () => {
    expect(FILES.transformDrag).not.toMatch(/upsertKeyframe/);
    expect(FILES.poseGestures).not.toMatch(/upsertKeyframe/);
    expect(FILES.meshGestures).not.toMatch(/upsertKeyframe/);
    expect(FILES.inputDrag).not.toMatch(/upsertKeyframe/);
  });

  it('no synthetic KeyboardEvent in gesture handlers', () => {
    expect(FILES.transformDrag).not.toMatch(/KeyboardEvent/);
    expect(FILES.poseGestures).not.toMatch(/KeyboardEvent/);
    expect(FILES.meshGestures).not.toMatch(/KeyboardEvent/);
    expect(FILES.inputDrag).not.toMatch(/KeyboardEvent/);
  });

  it('no direct computePoseOverrides in gesture handlers', () => {
    expect(FILES.transformDrag).not.toMatch(/computePoseOverrides/);
    expect(FILES.poseGestures).not.toMatch(/computePoseOverrides/);
    expect(FILES.meshGestures).not.toMatch(/computePoseOverrides/);
    expect(FILES.inputDrag).not.toMatch(/computePoseOverrides/);
  });
});

describe('non-animation gesture paths preserved', () => {
  it('PixiInputTransformDrag still uses previewPose for non-anim mode', () => {
    expect(FILES.transformDrag).toMatch(/_setPreviewPose/);
  });

  it('PixiInputDrag still uses commitTransformPreview for non-anim mode', () => {
    expect(FILES.inputDrag).toMatch(/commitTransformPreview/);
  });
});
