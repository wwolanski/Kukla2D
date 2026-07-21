import type { ProjectResourceOwner } from '@kukla2d/contracts';

export function createProjectResourceOwner(): ProjectResourceOwner {
  const urls: string[] = [];
  let disposed = false;

  return {
    track(url: string) {
      if (disposed) {
        URL.revokeObjectURL(url);
        return;
      }
      urls.push(url);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const url of urls) {
        URL.revokeObjectURL(url);
      }
      urls.length = 0;
    },
    transferOut(): string[] {
      if (disposed) return [];
      const transferred = urls.splice(0, urls.length);
      return transferred;
    },
    get size(): number {
      return urls.length;
    },
  };
}
