import { describe, expect, it } from 'vitest';
import {
  LIBRARY_ASSET_DRAG_MIME,
  readLibraryAssetDrag,
  writeLibraryAssetDrag,
} from '@/domain/libraryAssetDrag.js';

describe('library asset drag payload', () => {
  it('uses text/plain fallback when custom MIME is unavailable on canvas drop', () => {
    const data = new Map();
    const dataTransfer = {
      setData: (type, value) => data.set(type, value),
      getData: type => type === LIBRARY_ASSET_DRAG_MIME ? '' : data.get(type) ?? '',
    };

    writeLibraryAssetDrag(dataTransfer, 'asset-1');

    expect(readLibraryAssetDrag(dataTransfer)).toBe('asset-1');
  });
});
