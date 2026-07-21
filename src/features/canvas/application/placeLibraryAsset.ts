import type { AssetId, NodeId, PartNode, ProjectDocument, Texture } from '@kukla2d/contracts';

import { useEditorStore } from '@/store/editorStore';
import type { ProjectStore } from '@/store/project/projectStoreTypes';

import { clientToCanvasSpace } from '@/features/canvas/domain/coordinates.js';

import { uid } from '@/lib/uid.js';

import type {
  CanvasEditorSnapshot,
  CanvasSceneGateway,
  CanvasTextureCache,
  MutableRef,
} from './canvasApplicationTypes.js';
import type { CanvasDropEvent } from './handleCanvasDrop.js';

type PlacedFields = 'id' | 'parent' | 'textureId' | 'draw_order';
type PlaceablePartNode = Omit<PartNode, PlacedFields> & Partial<Pick<PartNode, PlacedFields>>;
type CachedImage = ImageData | HTMLImageElement;

interface PlaceLibraryAssetArgs {
  assetId: AssetId | string;
  event: CanvasDropEvent;
  projectRef: MutableRef<ProjectDocument>;
  canvasRef: MutableRef<HTMLCanvasElement | null>;
  editorRef: MutableRef<CanvasEditorSnapshot>;
  updateProject: ProjectStore['updateProject'];
  markDirty?: () => void;
  sceneGatewayRef?: MutableRef<CanvasSceneGateway | null>;
  textureCache?: CanvasTextureCache;
}

export function placeLibraryAsset({
  assetId, event, projectRef, canvasRef, editorRef, updateProject, markDirty, sceneGatewayRef, textureCache,
}: PlaceLibraryAssetArgs): Promise<boolean> {
  const sourceNode = projectRef.current.nodes.find((node): node is PartNode => node.type === 'part'
    && (node.id === assetId || node.textureId === assetId));
  const sourceTexture = projectRef.current.textures.find(texture => texture.id === assetId);
  const canvas = canvasRef.current;
  if (!sourceTexture || !canvas) return Promise.resolve(false);

  const [x, y] = clientToCanvasSpace(
    canvas,
    event.clientX,
    event.clientY,
    editorRef.current.view,
  );
  const addNode = (node: PlaceablePartNode, image: HTMLImageElement | null = null): boolean => {
    const newId = uid() as NodeId;
    const placedNode: PartNode = {
      ...node,
      id: newId,
      parent: null,
      textureId: assetId,
      draw_order: Math.max(-1, ...projectRef.current.nodes
        .filter(candidate => candidate.type === 'part')
        .map(candidate => candidate.draw_order ?? -1)) + 1,
      transform: { ...node.transform, x, y },
    };
    updateProject((projectDraft) => {
      projectDraft.nodes.push(placedNode);
    });
    primeGpuPart({
      gateway: sceneGatewayRef?.current,
      textureCache,
      sourceTexture,
      sourceId: assetId,
      partId: newId,
      node: placedNode,
      image,
    });
    useEditorStore.getState().setSelection([newId]);
    markDirty?.();
    return true;
  };

  if (sourceNode) return Promise.resolve(addNode({ ...structuredClone(sourceNode), name: `${sourceNode.name} Copy` }));

  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(addNode({
      type: 'part',
      name: sourceTexture.fileName?.replace(/\.[^.]+$/, '') ?? 'Library asset',
      opacity: 1,
      visible: true,
      clip_mask: null,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: image.width / 2, pivotY: image.height / 2 },
      meshOpts: null,
      mesh: null,
      imageWidth: image.width,
      imageHeight: image.height,
      imageBounds: { minX: 0, minY: 0, maxX: image.width, maxY: image.height },
      alphaContours: [],
    }, image));
    image.onerror = () => resolve(false);
    image.src = sourceTexture.source;
  });
}

interface PrimeGpuPartArgs {
  gateway: CanvasSceneGateway | null | undefined;
  textureCache: CanvasTextureCache | undefined;
  sourceTexture: Texture;
  sourceId: string;
  partId: string;
  node: PartNode;
  image: HTMLImageElement | null;
}

function primeGpuPart({
  gateway,
  textureCache,
  sourceTexture,
  sourceId,
  partId,
  node,
  image,
}: PrimeGpuPartArgs): void {
  if (!gateway) return;
  const cachedImage = image ?? textureCache?.__internal.imageDataByPartId.get(sourceId);
  if (!cachedImage) return;

  gateway.uploadTexture(partId, toCanvasSource(cachedImage));
  if (node.mesh) gateway.uploadMesh(partId, node.mesh);
  else if (node.imageWidth && node.imageHeight) gateway.uploadQuadFallback(partId, node.imageWidth, node.imageHeight);

  textureCache?.__internal.lastUploadedSources.set(partId, sourceTexture.source);
  if (!image && isImageData(cachedImage)) {
    textureCache?.__internal.imageDataByPartId.set(partId, cachedImage);
  }
}

function isImageData(image: CachedImage): image is ImageData {
  return 'data' in image && image.data instanceof Uint8ClampedArray;
}

function toCanvasSource(image: CachedImage): HTMLImageElement | HTMLCanvasElement {
  if (isImageData(image)) {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Failed to create 2D context for cached library asset');
    context.putImageData(image, 0, 0);
    return canvas;
  }
  return image;
}
