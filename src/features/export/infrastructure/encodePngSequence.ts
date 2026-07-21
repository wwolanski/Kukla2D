import type { EncoderInput, ExportArtifact } from '@kukla2d/contracts';

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}

export function buildPngFilePath(
  animationName: string,
  animationId: string,
  frameIndex: number,
  usedNames?: Map<string, string>,
): { fileName: string; relativePath: string; dir: string } {
  const base = animationName || 'animation';
  let dir = base;
  if (usedNames && usedNames.has(base)) {
    const existing = usedNames.get(base);
    if (existing !== animationId) {
      const safeId = String(animationId ?? 'animation')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '') || 'animation';
      dir = `${base}_${safeId}`;
    }
  } else if (usedNames) {
    usedNames.set(base, animationId);
  }
  const fileName = `frame_${String(frameIndex + 1).padStart(4, '0')}.png`;
  return { fileName, relativePath: `${dir}/${fileName}`, dir };
}

function isPngBlob(blob: Blob): boolean {
  return blob.type === 'image/png';
}

export async function encodePngSequence({ frames, area, animationName }: EncoderInput): Promise<ExportArtifact[]> {
  if (!frames || frames.length === 0) return [];

  const artifacts: ExportArtifact[] = [];
  const usedNames = new Map<string, string>();

  for (const frame of frames) {
    const blob = await dataUrlToBlob(frame.dataUrl);

    if (!isPngBlob(blob)) {
      const sniff = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
      const isPngSignature = sniff[0] === 0x89 && sniff[1] === 0x50 && sniff[2] === 0x4E && sniff[3] === 0x47;
      if (!isPngSignature) {
        throw new Error(`Frame ${frame.frameIndex + 1} is not a valid PNG (MIME: ${blob.type}, no PNG signature)`);
      }
    }

    if (frame.width !== area.outputWidth || frame.height !== area.outputHeight) {
      throw new Error(
        `Frame ${frame.frameIndex + 1} dimensions ${frame.width}x${frame.height} ` +
        `do not match plan ${area.outputWidth}x${area.outputHeight}`
      );
    }

    const { fileName, relativePath } = buildPngFilePath(
      animationName, frame.animationId, frame.frameIndex, usedNames
    );

    artifacts.push({ fileName, mimeType: 'image/png', blob, relativePath });
  }

  return artifacts;
}
