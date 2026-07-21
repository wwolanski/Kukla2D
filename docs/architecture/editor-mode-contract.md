# Editor Mode Contract

- Date: 2026-07-05
- Plan: 20, Etap 06

## Overview

The editor has two modes — **Staging** and **Animation** — with an explicit, enforceable contract governing what each mode permits. This contract is implemented via a pure policy function (`editorModePolicy`) and enforced at three layers: UI controls, keyboard shortcuts, and canvas gesture entry points.

## Mode Responsibilities

| Mode | Writes | Mutates setup |
|------|--------|---------------|
| **Staging** | Setup/structure: node transforms, bone transforms, pivot, length, bind, topology, mesh, weights, links, slots, IK | Yes |
| **Animation** | Pose/appearance only as authorable tracks | No |

## Allowed Operations

### Staging

All operations are allowed: node/bone transforms, pivot, length, bind, topology, remesh, weights, link toggle, slot, IK, hierarchy reorder, rename, library organize, selection, navigation.

### Animation

**Allowed (authorable tracks):**
- Node: x, y, rotation, scaleX, scaleY, opacity, visible, drawOrder, mesh_verts, blendShape
- Bone: x, y, rotation, scaleX, scaleY
- Constraint: targetX, targetY
- Rename, library organize, selection, navigation, playback

**Blocked (setup-only):**
- Bone length, pivot
- Bone create/delete/reparent
- IK create/assign
- Remesh, weights edit
- Link toggle, bind toggle
- Slot create/delete
- Hierarchy reorder

## Linked Image vs Bone Motion

The editor distinguishes two explicit targets for DnD in Animation mode:

| DnD Target | What is edited | Effect |
|------------|---------------|--------|
| **Linked image** (element) | Node offset pre-link | Image moves; bone stays still |
| **Bone** (rig) | Bone pose track | Bone moves; linked images follow |

This is enforced by the `linkedAnim` flag in canvas gesture state. The user sees the current target and can quickly switch to the linked bone via `useLinkedTargetInfo`.

## Length vs Scale

- **Bone length** defines the rig in Staging. It is a setup-only property.
- **ScaleX** is the authorable animation channel for stretching a bone. The effective bone segment uses `length * abs(scaleX)` for picking and rendering.

## Feedback Rules

Every blocked action has a `reasonCode` mapped to a canonical feedback entry (`editorModeFeedback.js`) containing:
- `message` — short user-facing text
- `tooltip` — longer explanation
- `suggestedAction` — what the user should do instead

Components consume `getFeedback(reasonCode)` and never duplicate these texts. The policy returns `allowed: false` with a `reasonCode` for all blocked actions.

## Policy Function

```js
editorModePolicy({ mode, actionId, targetKind?, property?, draftDirty? })
  → { allowed, mode, actionId, channel, reasonCode?, message?, suggestedAction? }
```

- `channel`: `'animation-channel'` | `'setup-structure'` | `'navigation'` | `'blocked'` | `'mode-transition'`
- `reasonCode`: stable string from `REASON_CODES` registry
- Pure function: no React, Zustand, DOM, or Pixi dependencies

## Mode Transitions

```js
requestEditorMode({ currentMode, nextMode, draftState?, hasActiveClip? })
  → { result: 'changed' | 'unchanged' | 'blocked-draft', reason? }
```

- Dirty draft blocks `animation → staging` with `blocked-draft`
- `animation → staging` triggers Commit/Discard/Cancel dialog
- `staging → animation` always succeeds and captures rest pose

### Pause-on-Exit Contract

Every successful Animation → Staging transition (clean exit, Commit, Discard)
calls `completeExitToStaging()` which:

1. Pauses transport (`isPlaying=false`, `_lastTimestamp=null`)
2. Sets mode to `staging`
3. Clears transition state
4. Preserves `currentTime`, `activeAnimationId`, `speed`, `loop`

Cancel does NOT pause or change mode — draft, playback, and mode remain
unchanged.

### Staging No-Tick

The RAF render loop in `useCanvasScene` guards `anim.tick(timestamp)` with
`editor?.editorMode === 'animation'`. In Staging mode, transport time never
advances even if `isPlaying` were somehow set.

## Defense-in-Depth

Every layer independently verifies the policy decision:
1. **UI controls** — disabled + tooltip via `getFeedback()`
2. **Keyboard shortcuts** — guard in `useCanvasKeyboardShortcuts.js`
3. **Canvas gesture entry** — policy check in `PixiBoneAssignment.commitDrawnBone`, `PixiIkConstraintGestures.handleIkPointerDown`, `PixiBoneTransformDrag.startBoneLength`, `PixiInputDrag.startPivotDrag`

## K8: Setup Invariant

Animation gestures must not mutate setup snapshot. Verified by:
- `nodes[].transform`, `bones[].setup`, links, constraints, and mesh topology are identical before and after animation commits
- Cross-layer regression test: `test/crossLayerEditorModeContract.test.js`

## References

- `src/domain/editorModePolicy.ts` — ACTION_IDS, REASON_CODES, editorModePolicy()
- `src/domain/editorModeFeedback.ts` — getFeedback(), getAllReasonCodes()
- `src/domain/editorModeTransition.ts` — requestEditorMode()
- `src/domain/animationProperties.ts` — isAuthorableProperty(), isPropertyAllowedForTargetKind()
- `src/features/canvas/domain/linkedNodeAuthoring.ts` — resolveLinkedNodeAuthoredTransform()
- `docs/architecture/overview.md` — Architecture overview
- `docs/architecture/state-history.md` — Zustand, XState, Immer undo
