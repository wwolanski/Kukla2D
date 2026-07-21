export { scanAlphaBounds } from './domain/phaserAtlasTrim.js';
export type { TrimResult } from './domain/phaserAtlasTrim.js';

export { packAtlasFrames, validatePackLayout } from './domain/phaserAtlasPacker.js';
export type {
  PackInput,
  PackResult,
  PackError,
  PackedRegion,
  PackedPage,
} from './domain/phaserAtlasPacker.js';

export { encodePhaserAtlasPackage } from './encodePhaserAtlasPackage.js';
export type {
  CapturedFrame,
  PackageOptions,
  ExportArtifact,
  EncodeResult,
} from './encodePhaserAtlasPackage.js';

export { decodePngDataUrl, composePageBlob, AbortError } from './browserImage.js';
export type { DecodedPng, CropSource, PageComposeSource } from './browserImage.js';

export {
  buildSingleAtlasJson,
  buildMultiAtlasJson,
} from './phaserAtlasJson.js';
export type {
  SingleAtlasJson,
  MultiAtlasJson,
  AtlasJsonRegion,
  MultiAtlasPageEntry,
} from './phaserAtlasJson.js';

export { buildAnimationJson, buildMarkerManifest } from './phaserAnimationJson.js';
export type {
  AnimationJson,
  AnimationJsonEntry,
  AnimationJsonFrame,
  AnimationInput,
  MarkerEntry,
  MarkerManifest,
} from './phaserAnimationJson.js';

export { buildExportReport, buildExampleTs, buildReadme } from './phaserPackageDocs.js';
export type {
  BakeReport,
  BakeReportEntry,
  BakeReportInput,
  ExampleInput,
  ReadmeInput,
} from './phaserPackageDocs.js';
