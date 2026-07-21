import { describe, it, expect } from 'vitest';
import { createTextureImageCache } from '@/features/canvas/infrastructure/textureImageCache.js';

describe('textureImageCache', () => {
  it('stores and retrieves last source', () => {
    const c = createTextureImageCache();
    c.setLastSource('a', 'blob:1');
    expect(c.getLastSource('a')).toBe('blob:1');
    c.setLastSource('a', null);
    expect(c.getLastSource('a')).toBeUndefined();
  });

  it('stores and retrieves imageData', () => {
    const c = createTextureImageCache();
    const id = { width: 1, height: 1, data: new Uint8ClampedArray(4) };
    c.setImageData('a', id);
    expect(c.getImageData('a')).toBe(id);
  });

  it('clearImageData wipes all but leaves sources', () => {
    const c = createTextureImageCache();
    c.setImageData('a', { width: 1, height: 1, data: new Uint8ClampedArray(4) });
    c.setImageData('b', { width: 1, height: 1, data: new Uint8ClampedArray(4) });
    c.setLastSource('a', 'blob:1');
    c.clearImageData();
    expect(c.getImageData('a')).toBeUndefined();
    expect(c.getImageData('b')).toBeUndefined();
    expect(c.getLastSource('a')).toBe('blob:1');
  });

  it('deletePart removes both source and imageData', () => {
    const c = createTextureImageCache();
    c.setImageData('a', { width: 1, height: 1, data: new Uint8ClampedArray(4) });
    c.setLastSource('a', 'blob:1');
    c.deletePart('a');
    expect(c.getImageData('a')).toBeUndefined();
    expect(c.getLastSource('a')).toBeUndefined();
  });

  it('asImageDataLookup returns a function that looks up by partId', () => {
    const c = createTextureImageCache();
    const id = { width: 1, height: 1, data: new Uint8ClampedArray(4) };
    c.setImageData('a', id);
    const fn = c.asImageDataLookup();
    expect(fn('a')).toBe(id);
    expect(fn('b')).toBeUndefined();
  });
});
