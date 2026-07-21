/**
 * Rendering fixtures for parity and unit tests.
 */

/**
 * Single-part render fixture: one part with quad mesh, identity-ish transform,
 * and placeholder texture entry. No real image files.
 */
export function createSinglePartRenderFixture() {
  const project = {
    nodes: [
      {
        id: 'part-1',
        type: 'part',
        name: 'Part 1',
        draw_order: 0,
        visible: true,
        opacity: 1,
        transform: {
          x: 10,
          y: 20,
          rotation: 15,
          scaleX: 1,
          scaleY: 1,
          pivotX: 50,
          pivotY: 50,
        },
        imageWidth: 100,
        imageHeight: 100,
        imageBounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
        mesh: {
          vertices: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 },
            { x: 0, y: 100 },
          ],
          uvs: [0, 0, 1, 0, 1, 1, 0, 1],
          indices: [0, 1, 2, 0, 2, 3],
        },
      },
    ],
    textures: {
      'part-1': { source: 'placeholder://part-1' },
    },
    canvas: { width: 200, height: 200 },
  };

  const editor = {
    view: { zoom: 1, panX: 0, panY: 0 },
  };

  return { project, editor };
}

/**
 * Hierarchy fixture: two parts where second part has reduced opacity
 * and first part is hidden. Tests visibility/opacity propagation.
 */
export function createHierarchyFixture() {
  const project = {
    nodes: [
      {
        id: 'part-hidden',
        type: 'part',
        name: 'Hidden Part',
        draw_order: 0,
        visible: false,
        opacity: 1,
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        mesh: {
          vertices: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }, { x: 0, y: 50 }],
          uvs: [0, 0, 1, 0, 1, 1, 0, 1],
          indices: [0, 1, 2, 0, 2, 3],
        },
      },
      {
        id: 'part-semi',
        type: 'part',
        name: 'Semi-Transparent',
        draw_order: 1,
        visible: true,
        opacity: 0.5,
        transform: { x: 25, y: 25, rotation: 0, scaleX: 1, scaleY: 1 },
        mesh: {
          vertices: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }, { x: 0, y: 50 }],
          uvs: [0, 0, 1, 0, 1, 1, 0, 1],
          indices: [0, 1, 2, 0, 2, 3],
        },
      },
    ],
    textures: {
      'part-hidden': { source: 'placeholder://hidden' },
      'part-semi': { source: 'placeholder://semi' },
    },
    canvas: { width: 100, height: 100 },
  };

  const editor = { view: { zoom: 1, panX: 0, panY: 0 } };
  return { project, editor };
}

/**
 * Warp deformer fixture: one part with a 2x2 warp grid.
 */
export function createWarpFixture() {
  const project = {
    nodes: [
      {
        id: 'part-warp',
        type: 'part',
        name: 'Warp Part',
        draw_order: 0,
        visible: true,
        opacity: 1,
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        mesh: {
          vertices: [
            { x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 },
            { x: 0, y: 50 }, { x: 50, y: 50 }, { x: 100, y: 50 },
            { x: 0, y: 100 }, { x: 50, y: 100 }, { x: 100, y: 100 },
          ],
          uvs: [0, 0, 0.5, 0, 1, 0, 0, 0.5, 0.5, 0.5, 1, 0.5, 0, 1, 0.5, 1, 1, 1],
          indices: [0, 1, 3, 1, 4, 3, 1, 2, 4, 2, 5, 4, 3, 4, 6, 4, 7, 6, 4, 5, 7, 5, 8, 7],
          warpGrid: {
            col: 2,
            row: 2,
            points: [
              { x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 },
              { x: 0, y: 50 }, { x: 50, y: 50 }, { x: 100, y: 50 },
              { x: 0, y: 100 }, { x: 50, y: 100 }, { x: 100, y: 100 },
            ],
          },
        },
      },
    ],
    textures: { 'part-warp': { source: 'placeholder://warp' } },
    canvas: { width: 100, height: 100 },
  };

  const editor = { view: { zoom: 1, panX: 0, panY: 0 } };
  return { project, editor };
}

/**
 * Skeleton overlay fixture: one part with bones.
 */
export function createSkeletonFixture() {
  const project = {
    nodes: [
      {
        id: 'part-sk',
        type: 'part',
        name: 'Skinned Part',
        draw_order: 0,
        visible: true,
        opacity: 1,
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        mesh: {
          vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
          uvs: [0, 0, 1, 0, 1, 1, 0, 1],
          indices: [0, 1, 2, 0, 2, 3],
        },
      },
    ],
    bones: [
      { id: 'bone-root', name: 'Root', setup: { x: 50, y: 100 }, parent: null },
      { id: 'bone-spine', name: 'Spine', setup: { x: 50, y: 50 }, parent: 'bone-root' },
    ],
    textures: { 'part-sk': { source: 'placeholder://sk' } },
    canvas: { width: 100, height: 100 },
  };

  const editor = { view: { zoom: 1, panX: 0, panY: 0 } };
  return { project, editor };
}

/**
 * Capture/resize fixture: minimal project for testing capture size restore.
 */
export function createCaptureFixture() {
  const project = {
    nodes: [
      {
        id: 'part-cap',
        type: 'part',
        name: 'Capture Part',
        draw_order: 0,
        visible: true,
        opacity: 1,
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        mesh: {
          vertices: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 150 }, { x: 0, y: 150 }],
          uvs: [0, 0, 1, 0, 1, 1, 0, 1],
          indices: [0, 1, 2, 0, 2, 3],
        },
      },
    ],
    textures: { 'part-cap': { source: 'placeholder://cap' } },
    canvas: { width: 200, height: 150 },
  };

  const editor = { view: { zoom: 1, panX: 0, panY: 0 } };
  return { project, editor };
}
