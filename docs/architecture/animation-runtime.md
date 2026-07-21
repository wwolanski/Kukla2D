# Animation Runtime

- Date: 2026-07-03
- Plan: 18, Etap 10

## Active Path

1. Timeline shell/components emit named intents through `useTimelineController`.
2. `createTimelineCommandApi` routes those intents to `projectStore` named
   actions.
3. `projectStore` executes document commands via Immer patch transactions.
4. `animationStore` owns active clip session, transport clock and draft pose.
5. `animationStore.tick()` advances playhead through `advanceAnimationTransport`.
6. `composeCanvasFrameState` calls `evaluateEditorFramePose`, applies shared
   warp deformer composition, and returns the final frame pose consumed by both
   RAF rendering and capture.
7. `PixiSceneGateway.drawFrame()` is active renderer sink for the editor canvas.

## Ownership

- Persisted:
  `project.animations[*]`, tracks, keyframes, markers, audio tracks.
- Runtime only:
  `activeAnimationId`, `currentTime`, `loop`, `startFrame`, `endFrame`, `speed`,
  `loopKeyframes`, `draftPose`, `loopCount`.

## Precedence

Frame composition order:

`defaultPose -> parameter overrides -> animation keyframes -> draft/preview -> runtime physics overrides -> constraints -> linked nodes -> warp deformer mesh overrides`

Physics reads pre-physics bones and returns transient overrides only. It does
not own document state and does not call back into the composer.

## Timeline Boundary

- `TimelinePanel`, `AnimationListPanel`, `TransportBar` are shell/views.
- Keyframe and audio leaves decode local UI state but persist through named
  intents only.
- Canonical keyframe address is `targetId:property:timeMs`.
- Property names may contain `:`, for example `blendShape:smile`; address parsing
  treats the first segment as target, the last as time and the middle as property.
- Graph edits use `editAnimationKeyframes` and atomic `editKeyframeBatch`.
  Time/value/easing changes validate the whole batch and reject collisions before
  mutation. A pointer gesture creates one history entry on pointer-up.

## Authoring Boundary

- Inspector and canvas emit preview values to the runtime-only draft.
- With auto-key enabled, a completed input/gesture commits changed channels in one
  transaction. With auto-key disabled, the draft remains pending.
- Dirty manual draft blocks seek, play, stop, clip switch/delete and animation-mode
  exit. The timeline exposes explicit Commit and Discard actions.
- Persisted edits flow through `@/features/animation` or timeline named commands;
  Pixi leaves do not import stores.

## Provenance & Keyframe Roles

Each keyframe carries an optional `authoring` metadata block (`KeyframeAuthoringMeta`):

```ts
{ gestureId: string, role: 'authored' | 'derived' | 'support', source: string }
```

- **authored** — channel explicitly manipulated by the user (Pose root, Transform
  selection, direct Inspector edit, K snapshot). Visible in timeline.
- **derived** — automatic side effect of a gesture (Pose branch descendants from
  `buildRotatedBoneBranch`). Hidden from individual timeline dots.
- **support** — automatic baseline keyframe at loop start needed for correct
  playback of derived keys. Hidden from timeline.
- **Legacy** — keyframes without `authoring` metadata are treated as `authored`
  and fully visible.

Promotion rule: a new `authored` keyframe at an address occupied by `derived`/`support`
replaces the provenance. Later group operations on the old gesture do not affect it.

## Manual K Channel Matrix

`K` without dirty draft (snapshot) writes these core transform channels only:

| Target type | Channels |
|-------------|----------|
| Node / Bone | `x, y, rotation, scaleX, scaleY` |
| Constraint | `targetX, targetY` |

Not included: `opacity`, `visible`, `mesh_verts`, `blendShape:*`, constraint `mix`,
`fkIk`, `bendPositive`, `order`.

`K` with a dirty draft commits exactly the drafted channels plus their hidden
derived/support keys. Selection is not expanded.

Result reported as `mode: 'draft' | 'snapshot-core' | null`.

## Keyframe Guide

Empty clips (no visible authored keyframes) show a non-destructive guide overlay.
`buildKeyguideFrames({startFrame,endFrame,fps,hasVisibleKeyframes})` computes
marker frames at `max(1, round(fps/2))` intervals between start and end.

Guide markers are labeled Start / Guide / End. Clicking a guide marker only seeks
the playhead; it never creates or modifies keyframes.

## Visible vs Materialized Keys

- **Visible (timeline)** — authored keys only. `isTimelineVisibleKeyframe()` in
  `src/domain/keyframeProvenance.ts` filters derived/support.
- **Materialized (document)** — all keys including derived and support. The
  evaluator sees the full track. Group operations (move/delete/easing) use
  `expandGestureKeyframes()` to include hidden keys of the same gesture group
  before mutation.

## Rendered Channels

- Node transform, opacity, visibility and draw order resolve into effective nodes.
- Bone and IK channels resolve before linked-node composition.
- Explicit `mesh_verts` has precedence over generated blend-shape deformation.
- `blendShape:*` weights are read from animation/draft overrides and generate final
  `mesh_verts` from base vertices before the Pixi mesh sink.
- Warp deformer `mesh_verts` are composed once in
  `src/features/canvas/application/composeCanvasFrameState.ts`. RAF and capture
  share this path; neither owns a separate warp pipeline.

## Non-Active Engine

`packages/engine` remains experimental and non-canvas. It is not wired into the
editor runtime path and needs a separate ADR before any integration.

## Frame Capture Contract

Frame export uses an isolated capture path that does not mutate session state.
`captureExportFrame` accepts a `FrameCaptureRequest` (K5) and returns a
`FrameCaptureResult` (K6). It builds an animation state override with
`isPlaying: false` and no draft pose, then calls `captureFrame` with
`animationStateOverride` and `includeTransientPose: false`. The active playhead,
draft pose, and document are unchanged after capture.
Crop requests provide a temporary view override only for the export frame; the
live frame is restored in `finally`.

See `docs/architecture/project-document.md` for K5/K6 shape and ownership.
