/**
 * Pixel diff helper — compares two ImageData objects channel-by-channel.
 *
 * @param {ImageData} a
 * @param {ImageData} b
 * @param {{ tolerancePerChannel?: number, maxDifferentPixelsRatio?: number }} [options]
 * @returns {{ width: number, height: number, differentPixels: number, differentPixelsRatio: number, maxChannelDelta: number, pass: boolean, reason?: string }}
 */
export function compareImageData(a, b, { tolerancePerChannel = 0, maxDifferentPixelsRatio = 0 } = {}) {
  if (a.width !== b.width || a.height !== b.height) {
    return {
      width: Math.max(a.width, b.width),
      height: Math.max(a.height, b.height),
      differentPixels: -1,
      differentPixelsRatio: 1,
      maxChannelDelta: -1,
      pass: false,
      reason: 'size mismatch',
    };
  }

  const { width, height } = a;
  const totalPixels = width * height;
  const dataA = a.data;
  const dataB = b.data;

  let differentPixels = 0;
  let maxChannelDelta = 0;

  for (let i = 0; i < dataA.length; i += 4) {
    const rDiff = Math.abs(dataA[i] - dataB[i]);
    const gDiff = Math.abs(dataA[i + 1] - dataB[i + 1]);
    const bDiff = Math.abs(dataA[i + 2] - dataB[i + 2]);
    const aDiff = Math.abs(dataA[i + 3] - dataB[i + 3]);

    const localMax = Math.max(rDiff, gDiff, bDiff, aDiff);
    if (localMax > maxChannelDelta) {
      maxChannelDelta = localMax;
    }

    if (localMax > tolerancePerChannel) {
      differentPixels++;
    }
  }

  const differentPixelsRatio = totalPixels > 0 ? differentPixels / totalPixels : 0;

  return {
    width,
    height,
    differentPixels,
    differentPixelsRatio,
    maxChannelDelta,
    pass: differentPixelsRatio <= maxDifferentPixelsRatio,
  };
}
