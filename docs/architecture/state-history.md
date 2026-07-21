# State, History & Workflow

- Date: 2026-06-26
- Plan: 10, Etap 04

## Zustand Stores

All stores live in `src/store/` and use Zustand 5's typed, curried
`create<Store>()(...)` API. Public contracts keep state, actions and stable
selectors explicit; `test/types/*Store*.contract.ts` protects those boundaries.

### projectStore (`src/store/projectStore.ts`)

Single source of truth for the document model (nodes, animations, bones, slots, attachments, skins, constraints). Mutations go through Immer `produceWithPatches` so that every change generates forward/inverse patches for undo/redo.
Timeline persistence also lives here: named clip/keyframe/audio commands are
executed as patch transactions before runtime session reconciliation.

### editorStore (`src/store/editorStore.ts`)

Durable editor UI values: selection IDs, viewport zoom/pan, layer tabs,
overlay/brush configuration and transient presentation payloads. It does not
contain workflow tools, modes, gesture sessions or import status.
Its state factory creates fresh `Set`/object instances and defines every value
read by tools, including brush size and hardness.

### animationStore (`src/store/animationStore.ts`)

Playback runtime state: playhead, FPS, loop, speed, rest pose, draft pose. Does not own animation data (that lives in projectStore).
`animationStore.tick()` advances only transport/session state. It must not mutate
the persisted document; frame evaluation consumes its snapshot through
`evaluateEditorFramePose`.
Reset and clip-switch actions atomically clear foreign draft context,
provenance and revision state.

## Undo/Redo via Immer Patches

**Location:** `src/store/undoHistory.ts`

The undo system is patch-based, not snapshot-based. Every `projectStore` mutation using `produceWithPatches` pushes forward+inverse Immer patches onto the undo stack.

### Key APIs

- `pushPatches(forward, inverse)` — low-level: push patches onto undo stack
- `transaction(name, type, fn)` — high-level: groups multiple patches into one undo entry (e.g. "Batch edit")
- `beginBatch()` / `endBatch()` — manual batch control
- `undo(applyFn)` / `redo(applyFn)` — pop and apply inverse/forward patches
- `clearHistory()` — reset stacks (called on project load)
- `peekUndo()` — preview next undo entry metadata

### Timeline rules

- One named timeline intent should create at most one undo entry.
- Keyframe/audio drag gestures may batch intermediate updates, but undo still
  collapses to one semantic gesture entry.
- Runtime playback/evaluation (`animationStore.tick`, `evaluateEditorFramePose`)
  does not write patches and must leave `projectStore.project` unchanged.
- Gesture group operations (move/delete/easing) use `expandGestureKeyframes()`
  to include hidden derived/support keys of the same gesture group, then execute
  as a single patch transaction — one undo entry per semantic action.

### Draft Authoring (Animation)

`animationStore` maintains a parallel `draftAuthoring` map
(`Map<targetId, Record<property, { gestureId, role, source }>>`) alongside
`draftPose`. It tracks the provenance of each pending edit channel:

- **beginGesture** generates a stable `gestureId`; all previews within the
  gesture share it.
- **clearDraftAuthoring** / **clearDraftAuthoringForNode** kept in sync with
  their draftPose counterparts.
- **commitDraft** pairs each edit with its provenance metadata before persisting.
- **cancelGesture** / **resetPlayback** / **switchAnimation** / **reconcileRuntimeSession**
  clear draftAuthoring symmetrically.

One gesture → one undo entry (C4). The `gestureId` scope is used during commit for
recalculation (R6) and promotion (R5).

### Constraints

- `MAX_HISTORY = 50` entries
- Patches must be applied via the provided `applyPatches` helper (Immer compatibility)
- `clearHistory()` must be called when loading a new project
- Undo/redo operates only on `projectStore` document state, not on `editorStore` UI state

### Where NOT to replace state directly

UI components must not call `editorStore.setState(...)` with a full replacement. Use the store's action methods instead. The undo system only tracks `projectStore` patches — `editorStore` mutations are not undoable.

## XState Workflow

**Location:** `src/features/canvas/domain/editorWorkflowMachine.ts`

XState v5 (`setup` + `assign`) is the sole owner of active tool, selection
target, rig/mesh/weight modes, gesture session and import status. One
`EditorWorkflowContext.Provider` owns one actor. Every event executes its
commands through the configured `emitCommands` action; direct actor refs and
React hooks therefore have identical semantics.

XState does not own document data, selection IDs, view/overlay/brush values or
undo history. Imperative Pixi reads a merged, read-only frame snapshot composed
from actor context and durable Zustand values; no workflow value is mirrored
back into Zustand.

## Test Coverage

- `test/undoHistory.test.js` — undo/redo, batching, transaction, history limits
- `test/canvas/editorWorkflowMachine.test.js` — workflow state transitions
- `test/canvas/workflowIntegration.test.js` — workflow + canvas integration

## References

- `docs/architecture/overview.md` — full architecture context
- `package.json` — current Zustand, Immer, and XState versions
