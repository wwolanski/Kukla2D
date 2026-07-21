let cached: null | (new (...args: never[]) => unknown) = null;

export async function loadZipAdapter(): Promise<new (...args: never[]) => unknown> {
  if (cached) return cached;
  const { default: JSZip } = await import('jszip');
  cached = JSZip;
  return JSZip;
}
