# Project Document Contracts

- Date: 2026-07-06
- Plan: 22

## Contracts

### K1: RuntimeProjectDocument

Active store shape. Persistent top-level fields match the canonical adapter field set: `version`, `canvas`, `textures`, `nodes`, `bones`, `slots`, `attachments`, `skins`, `constraints`, `defaultPose`, `animations`, `parameters`, `physics_groups`, `physicsRules`, `libraryFolders`, `assetPlacements`. Mesh runtime data may still hold object vertices (`{x, y, restX?, restY?}`), triangle triples, `Float32Array` `uvs`, `edgeIndices`, `boneWeights`, and `influences` in memory; portable snapshot converts runtime data to JSON-safe values.

- Owner: `projectStore` (Zustand + Immer)
- Validation: `src/schema/projectSchema.ts` (Zod, version 6)
- Types: `packages/contracts/src/project.ts`

### K2: PortableProjectDocumentV6

JSON-safe snapshot for `.kk2d` ZIP. All persisted fields: `version`, `canvas`, `textures`, `nodes`, `bones`, `slots`, `attachments`, `skins`, `constraints`, `defaultPose`, `animations`, `parameters`, `physics_groups`, `physicsRules`, `libraryFolders`, `assetPlacements`. No `undefined`, no TypedArray, no Set, no Map, no DOM objects, no runtime-only caches.

- Owner: `src/schema/projectSnapshot.ts` (`createPortableProjectSnapshot`)
- Conversion: `Float32Array` -> `number[]`, `Set` -> `number[]`
- Validation: same Zod schema as K1

### K3: MeshTopologyImpact

```
{ vertexCountChanged: boolean, blendShapeIds: string[], meshTrackAddresses: string[], hasWeights: boolean }
```

- Owner: `src/features/canvas/domain/meshTopologyCommands.ts` (`analyzeMeshTopologyImpact`)
- Used by: `useMeshCommands.getRemeshImpact`, `MeshPanel` confirm dialog

### K4: ProjectLoadResult / PreparedWorkspaceLoad

`ProjectLoadResult`:

```
{ project: PortableProjectDocumentV6, images: Map<string, HTMLImageElement>, resources: ResourceOwner }
```

`resources.dispose()` is idempotent. On codec/materialization failure, all staging URLs are revoked.

`PreparedWorkspaceLoad`:

```
{ preparedProjectState, stagedImageData, stagedResources }
```

Store state, image-data cache, Pixi resource registry and URL owner are swapped as one synchronous commit. Decode, image-data extraction and GPU resource creation happen before commit. Any failure before or during commit leaves the previous workspace active; previous URLs/registry are disposed only after successful swap. `loadProject` accepts `.kk2d`; manifest-less `.kk2d_legacy` remains legacy compatibility only when `project.json` validates. Commit receives the new resource owner separately.

- Owner: `src/io/projectFile.ts` (`loadProject`)
- Commit owner: `src/features/canvas/application/workspaceLoadTransaction.ts`

### K5: FrameCaptureRequest

```
{ animationId: string|null, timeMs: number, width: number, height: number, format: 'png'|'jpg'|'webp', quality: number, background: {enabled: boolean, color: string}|null, crop: {x: number, y: number, width?: number, height?: number}|null }
```

- Owner: `src/features/canvas/domain/frameCaptureContract.ts` (`createFrameCaptureRequest`)
- Validation: `timeMs >= 0`, `width/height > 0`, `format` in enum, `quality` 0..1, crop `x/y` finite, optional crop `width/height > 0`

### K6: FrameCaptureResult

```
{ ok: true, dataUrl: string, width: number, height: number } | { ok: false, error: { code: string, message: string } }
```

- Owner: `src/features/canvas/application/useCanvasCapture.ts` (`captureExportFrame`)

### K7: ReadinessReport

```
{ errors: Issue[], warnings: Issue[] }
```

Issue: `{ code: string, path: string, message: string }`. Stable codes: `DOCUMENT_INVALID`, `ASSET_SOURCE_MISSING`, `MESH_TOPOLOGY_INVALID`, `MESH_TRACK_VERTEX_COUNT_MISMATCH`, `DANGLING_TARGET`, `CAPTURE_REQUEST_UNSUPPORTED`.

- Owner: `src/domain/projectReadiness.ts` (`analyzeProjectReadiness`)
- Pure function, no side effects

### K8: Invariants

- `projectStore` owns persisted animations; `animationStore` owns runtime session
- Pixi is the sole active renderer
- `packages/engine` is experimental, not wired into editor path
- Domain layer (`src/domain/**`) has no React/Zustand/DOM/WebGL/Worker imports

### K9: ExportReadinessDecision / PendingExport

```
{ kind: 'blocked'|'confirm'|'ready', target: 'frames'|'spine'|'live2d'|'live2d_project', report: ReadinessReport }
{ target, report, execute }
```

- Owner: `src/features/export/application/useExportReadinessGate.ts`
- Errors block before executor side effects.
- Warnings require explicit Continue/Cancel for every export target.
- Pending execute is single-use and cleared on Cancel, close and type change.

## Resource Lifecycle

`createProjectResourceOwner` (`src/platform/projectResourceOwner.ts`) tracks object URLs. `dispose()` revokes all tracked URLs and is idempotent. `useCanvasController` creates the owner and passes it via `resourceOwnerRef`. On project swap, the previous owner is disposed after the new one is committed.

## Save/Load Flow

1. Save: `createPortableProjectSnapshot` -> `validateProject` -> resolve assets (fail-closed) -> write `.kk2d` ZIP with manifest
2. Load: decode ZIP -> inspect manifest/legacy marker -> `loadProject` -> validate -> hydrate images/audio -> return K4
3. Atomic commit: `stageWorkspaceLoad` builds image data, GPU resources and prepared store state before mutating workspace; failure leaves previous project/cache/registry/URL owner intact

## Adding Persisted Project Fields

1. Add default in `createEmptyProject`.
2. Add schema support in `projectSchema`.
3. Add field to `PERSISTED_PROJECT_FIELDS` / adapter mapping.
4. Decide migration path in `migrateProject`.
5. Update golden fixture in `test/fixtures/goldenProject.ts`.
6. Add round-trip and negative tests in `test/projectDocumentContract.test.ts` and `test/projectFile.test.js`.
7. Update UI/DB only if field is user-facing.

Runtime session state, playhead, undo history, dirty flag, and project autosave are outside this persisted-document contract.

## Capture Flow

1. `useFrameExportJob` builds K5 via `createFrameCaptureRequest`
2. `captureExportFrame` creates isolated animation state snapshot (`animationStateOverride`, `includeTransientPose: false`)
3. `captureFrame` renders through `composeCanvasFrameState`, including warp deformer composition, then returns K6
4. Session state (playhead, draft, document) is unchanged after capture

## Preflight Flow

1. `analyzeProjectReadiness(project, target)` returns K7
2. Save: errors block (AlertDialog), warnings require confirmation
3. Export: `ExportModal` owns readiness gate; errors block, warnings require Continue/Cancel, clean report executes immediately
4. Export jobs are effect executors and do not run their own readiness bypass
5. Pure function, no fetch/ZIP/DOM/store mutation

## References

- `test/fixtures/goldenProject.ts` — canonical fixture for all contract tests
- `src/schema/projectDocumentAdapter.ts` — canonical persistent field set and load adapter
- `test/projectDocumentContract.test.ts` — K1/K2/C5 tests
- `test/projectFile.test.js` — save/load round-trip, fail-closed
- `test/canvas/meshTopologyCommands.test.js` — K3, topology invariants
- `test/canvas/frameCaptureContract.test.js` — K5/K6
- `test/projectReadiness.test.js` — K7
- `docs/architecture/animation-runtime.md` — active animation path
