import type { PackedPage } from './domain/phaserAtlasPacker.js';

export interface AtlasJsonRegion {
  name: string;
  frame: { x: number; y: number; w: number; h: number };
  rotated: false;
  trimmed: boolean;
  spriteSourceSize: { x: number; y: number; w: number; h: number };
  sourceSize: { w: number; h: number };
}

export interface SingleAtlasJson {
  frames: Record<string, AtlasJsonRegion>;
  meta: { app: string; version: string; image: string; format: string; scale: string };
}

export interface MultiAtlasPageEntry {
  image: string;
  frames: Array<{ filename: string } & AtlasJsonRegion>;
}

export interface MultiAtlasJson {
  textures: MultiAtlasPageEntry[];
  meta: { app: string; version: string; format: string; scale: string };
}

export function buildSingleAtlasJson(
  page: PackedPage,
  pageFileName: string,
  scale: string,
): SingleAtlasJson {
  const frames: Record<string, AtlasJsonRegion> = {};
  for (const r of page.regions) {
    frames[r.name] = {
      name: r.name,
      frame: { ...r.frame },
      rotated: false,
      trimmed: r.trimmed,
      spriteSourceSize: { ...r.spriteSourceSize },
      sourceSize: { ...r.sourceSize },
    };
  }
  return {
    frames,
    meta: {
      app: 'Kukla2D',
      version: '1',
      image: pageFileName,
      format: 'RGBA8888',
      scale,
    },
  };
}

export function buildMultiAtlasJson(
  pages: readonly PackedPage[],
  pageFileNames: readonly string[],
  scale: string,
): MultiAtlasJson {
  const textures: MultiAtlasPageEntry[] = [];
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]!;
    const frames = page.regions.map((r) => ({
      filename: r.name,
      name: r.name,
      frame: { ...r.frame },
      rotated: false as const,
      trimmed: r.trimmed,
      spriteSourceSize: { ...r.spriteSourceSize },
      sourceSize: { ...r.sourceSize },
    }));
    textures.push({ image: pageFileNames[i]!, frames });
  }
  return {
    textures,
    meta: {
      app: 'Kukla2D',
      version: '1',
      format: 'RGBA8888',
      scale,
    },
  };
}
