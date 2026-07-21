import type { Mesh, ProjectDocument, ProjectResourceOwner } from '@kukla2d/contracts';

import { computeAlphaContours } from './imageUtils.js';

export interface WorkspaceCommitPort {
  commitProject(project: ProjectDocument): void;
}

export interface StagedRendererResources {
  uploadTexture(partId: string, img: HTMLImageElement): void;
  uploadMesh(partId: string, mesh: Mesh): void;
  uploadQuadFallback(partId: string, width: number, height: number): void;
  commit(): ResourceRegistry;
  dispose(): void;
  resources: ResourceRegistry;
}

export interface ResourceRegistry {
  disposeAll(): void;
}

export interface SceneGatewayLoadPort {
  createStagedResources?(): StagedRendererResources | null | undefined;
  swapResources(resources: ResourceRegistry): ResourceRegistry;
}

export interface WorkspaceLoadStage {
  project: ProjectDocument;
  stagedImageData: Map<string, ImageData>;
  stagedResources: StagedRendererResources | null;
}

function extractImageData(img: HTMLImageElement): ImageData {
  const off = document.createElement('canvas');
  off.width = img.width;
  off.height = img.height;
  const ctx = off.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2d context for image data extraction');
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, img.width, img.height);
}

function replaceMapContents<K, V>(target: Map<K, V>, source: Map<K, V>): void {
  target.clear();
  for (const [key, value] of source) {
    target.set(key, value);
  }
}

function uploadProjectResources(
  stagedResources: StagedRendererResources | null | undefined,
  project: ProjectDocument,
  images: Map<string, HTMLImageElement>,
): void {
  if (!stagedResources) return;
  for (const node of project.nodes) {
    if (node.type !== 'part') continue;
    const img = images.get(node.textureId ?? node.id);
    if (img) {
      stagedResources.uploadTexture(node.id, img);
    }
    if (node.mesh) {
      stagedResources.uploadMesh(node.id, node.mesh);
    } else if (node.imageWidth && node.imageHeight) {
      stagedResources.uploadQuadFallback(node.id, node.imageWidth, node.imageHeight);
    }
  }
}

export interface StageWorkspaceLoadParams {
  loadedProject: ProjectDocument;
  images: Map<string, HTMLImageElement>;
  sceneGateway?: SceneGatewayLoadPort | null;
}

export function stageWorkspaceLoad({
  loadedProject,
  images,
  sceneGateway,
}: StageWorkspaceLoadParams): WorkspaceLoadStage {
  let stagedResources: StagedRendererResources | null = null;
  try {
    const stagedImageData = new Map<string, ImageData>();
    for (const node of loadedProject.nodes) {
      if (node.type !== 'part') continue;
      const img = images.get(node.textureId ?? node.id);
      if (!img) continue;
      const imageData = extractImageData(img);
      stagedImageData.set(node.id, imageData);
      node.alphaContours = computeAlphaContours(imageData);
    }

    stagedResources = sceneGateway?.createStagedResources?.() ?? null;
    uploadProjectResources(stagedResources, loadedProject, images);
    return { project: loadedProject, stagedImageData, stagedResources };
  } catch (err) {
    stagedResources?.dispose?.();
    throw err;
  }
}

export interface CommitWorkspaceLoadParams {
  stagedLoad: WorkspaceLoadStage;
  commitPort: WorkspaceCommitPort;
  sceneGateway?: SceneGatewayLoadPort | null;
  imageDataMap: Map<string, ImageData>;
  resourceOwnerRef: { current: ProjectResourceOwner };
  resources: ProjectResourceOwner;
}

export function commitWorkspaceLoad({
  stagedLoad,
  commitPort,
  sceneGateway,
  imageDataMap,
  resourceOwnerRef,
  resources,
}: CommitWorkspaceLoadParams): ResourceRegistry | null {
  const { project, stagedImageData, stagedResources } = stagedLoad;
  let previousRegistry: ResourceRegistry | null = null;
  let committedResources = false;
  try {
    if (stagedResources) {
      previousRegistry = stagedResources.commit();
      committedResources = true;
    }
    commitPort.commitProject(project);
    replaceMapContents(imageDataMap, stagedImageData);
    resourceOwnerRef.current = resources;
    return previousRegistry;
  } catch (err) {
    if (committedResources && sceneGateway && previousRegistry) {
      sceneGateway.swapResources(previousRegistry);
      stagedResources?.resources?.disposeAll?.();
    } else {
      stagedResources?.dispose?.();
    }
    throw err;
  }
}
