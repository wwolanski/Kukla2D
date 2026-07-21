const PROJECT_EXTENSION_RE = /\.(kk2d|stretch)$/i;

export const PROJECT_FILE_EXTENSION = 'kk2d';
export const LEGACY_PROJECT_FILE_EXTENSION = 'stretch';
export const PROJECT_ARCHIVE_FORMAT_ID = 'kukla2d.dev/project';
export const PROJECT_ARCHIVE_VERSION = 1;
export const PROJECT_JSON_PATH = 'project.json';
export const PROJECT_MANIFEST_PATH = 'manifest.json';

export function hasProjectFileExtension(name: string): boolean {
  if (typeof name !== 'string') {
    return false;
  }
  return PROJECT_EXTENSION_RE.test(name);
}

export function stripProjectExtension(name: string): string {
  if (typeof name !== 'string') {
    return '';
  }
  return name.replace(PROJECT_EXTENSION_RE, '');
}

export function buildProjectFileName(name: string): string {
  const baseName = stripProjectExtension(name).trim();
  return `${baseName || 'project'}.${PROJECT_FILE_EXTENSION}`;
}
