export async function exportLive2D(
  project: Record<string, unknown>,
  images: Map<string, HTMLImageElement>,
  opts?: {
    modelName?: string;
    atlasSize?: number;
    exportMotions?: boolean;
    onProgress?: (message: string) => void;
  },
): Promise<Blob>;
