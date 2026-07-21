# @kukla2d/engine

**Status: experimental — non-canvas runtime.**

This package provides a standalone `EditorEngine` class intended for
headless or server-side evaluation. It is **not** connected to the active
Pixi-based canvas and must not be used as the frame evaluation path for
the editor.

## Why it exists

The `EditorEngine` was an early prototype for a pluggable rendering
pipeline. The active canvas uses `evaluateEditorFramePose` from
`src/features/canvas/application/` which orchestrates the canonical
frame pipeline: session → pre-frame → physics policy → final frame.

## Boundary

- `EditorEngine.evaluate()` ignores time/track evaluation and does not
  implement the animation pipeline described in the architecture docs.
- It must not be imported by `src/features/canvas/**` or any production
  runtime path.
- Changes to this package require a separate ADR and compatibility proof
  before integration with the canvas.
