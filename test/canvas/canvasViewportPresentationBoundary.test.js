import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const VIEW_PATH = 'src/features/canvas/components/CanvasViewport.jsx';

describe('CanvasViewport presentation boundary', () => {
  it('delegates project commands and persistence to its typed controller', async () => {
    const source = await readFile(VIEW_PATH, 'utf8');

    expect(source).toContain('useCanvasViewportController');
    expect(source).not.toMatch(/\buseProjectStore\b/);
    expect(source).not.toMatch(/\bupdateProject\b/);
    expect(source).not.toMatch(/\breadRecovery\b/);
    expect(source).not.toMatch(/\bbakeDefaultPoseIntoSetup\b/);
    expect(source).not.toMatch(/import\([^)]*\/domain\//);
  });
});
