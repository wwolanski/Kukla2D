const exampleProjectAssets = import.meta.glob<string>(
  '../assets/example-project/*.kk2d',
  { eager: true, query: '?url', import: 'default' },
);

export async function loadExampleProjectFile(): Promise<File> {
  const urls = Object.values(exampleProjectAssets);
  if (urls.length !== 1) {
    throw new Error(`Expected exactly one example project, found ${urls.length}`);
  }

  const response = await fetch(urls[0]!);
  if (!response.ok) {
    throw new Error(`Example project could not be loaded (HTTP ${response.status})`);
  }
  const blob = await response.blob();
  return new File([blob], 'example-project.kk2d', { type: 'application/zip' });
}
