// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { buildCanvasFrame } from '@/features/canvas/domain/canvasFrame.js';

describe('buildCanvasFrame', () => {
  const project = {
    nodes: [{ id: 'part-1', type: 'part' }],
  };
  const editor = {
    view: { zoom: 2, panX: 10, panY: 20 },
  };
  const canvasSize = { width: 800, height: 600 };
  const poseOverrides = new Map();
  const options = { skipResize: true };

  it('does not mutate inputs', () => {
    const projectClone = structuredClone(project);
    const editorClone = structuredClone(editor);
    const canvasSizeClone = { ...canvasSize };

    buildCanvasFrame({ project, editor, isDark: true, poseOverrides, canvasSize, options });

    expect(project).toEqual(projectClone);
    expect(editor).toEqual(editorClone);
    expect(canvasSize).toEqual(canvasSizeClone);
  });

  it('view equals editor.view', () => {
    const frame = buildCanvasFrame({ project, editor, isDark: true, poseOverrides, canvasSize, options });
    expect(frame.view).toBe(editor.view);
  });

  it('canvasSize is passed through', () => {
    const frame = buildCanvasFrame({ project, editor, isDark: false, poseOverrides, canvasSize, options });
    expect(frame.canvasSize).toBe(canvasSize);
    expect(frame.canvasSize.width).toBe(800);
    expect(frame.canvasSize.height).toBe(600);
  });

  it('nodes equals project.nodes', () => {
    const frame = buildCanvasFrame({ project, editor, isDark: true, poseOverrides, canvasSize, options });
    expect(frame.nodes).toBe(project.nodes);
  });

  it('preserves isDark and options', () => {
    const frame = buildCanvasFrame({ project, editor, isDark: false, poseOverrides: null, canvasSize, options: {} });
    expect(frame.isDark).toBe(false);
    expect(frame.options).toEqual({});
  });
});
