export const LIBRARY_ASSET_DRAG_MIME = 'application/x-kukla2d-library-asset';
const TEXT_PREFIX = 'kukla2d-library-asset:';

export function writeLibraryAssetDrag(dataTransfer: DataTransfer, assetId: string): void {
  dataTransfer.setData(LIBRARY_ASSET_DRAG_MIME, assetId);
  dataTransfer.setData('text/plain', `${TEXT_PREFIX}${assetId}`);
}

export function readLibraryAssetDrag(dataTransfer: DataTransfer): string {
  const customValue = dataTransfer.getData(LIBRARY_ASSET_DRAG_MIME);
  if (customValue) return customValue;
  const text = dataTransfer.getData('text/plain');
  return text.startsWith(TEXT_PREFIX) ? text.slice(TEXT_PREFIX.length) : '';
}

export function isLibraryAssetDrag(dataTransfer: DataTransfer | null | undefined): boolean {
  const types = Array.from(dataTransfer?.types ?? []);
  return types.includes(LIBRARY_ASSET_DRAG_MIME) || types.includes('text/plain');
}
