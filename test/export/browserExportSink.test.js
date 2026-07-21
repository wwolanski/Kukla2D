import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { browserExportSink } from '@/features/export/infrastructure/browserExportSink';

function makeArtifact(overrides = {}) {
  return {
    fileName: 'frame_0001.png',
    mimeType: 'image/png',
    blob: new Blob(['fake-png'], { type: 'image/png' }),
    relativePath: 'idle/frame_0001.png',
    ...overrides,
  };
}

function stubDocument() {
  const clickSpy = vi.fn();
  let currentAnchor;
  vi.stubGlobal('document', {
    createElement: vi.fn((tag) => {
      if (tag === 'a') {
        currentAnchor = { href: '', download: '', click: clickSpy };
        return currentAnchor;
      }
      return {};
    }),
  });
  return { clickSpy, getAnchor: () => currentAnchor };
}

describe('browserExportSink', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:http://test/export'),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('single artifact download', () => {
    it('downloads single artifact', async () => {
      const { clickSpy } = stubDocument();

      const artifacts = [makeArtifact({ fileName: 'test.png' })];
      const result = await browserExportSink(artifacts);

      expect(result.ok).toBe(true);
      expect(globalThis.URL.createObjectURL).toHaveBeenCalledOnce();
      expect(clickSpy).toHaveBeenCalledOnce();
    });

    it('uses anchor download attribute', async () => {
      const { getAnchor } = stubDocument();

      const artifacts = [makeArtifact({ fileName: 'my_anim/frame_0001.png' })];
      await browserExportSink(artifacts);

      expect(getAnchor().download).toBe('my_anim/frame_0001.png');
    });

    it('uses ZIP for single artifact when destination is zip', async () => {
      const { clickSpy } = stubDocument();

      const artifacts = [makeArtifact()];
      const result = await browserExportSink(artifacts, { destination: 'zip', projectName: 'my-project' });

      expect(result.ok).toBe(true);
      expect(globalThis.URL.createObjectURL).toHaveBeenCalledOnce();
      expect(clickSpy).toHaveBeenCalledOnce();
    });

    it('revokes object URL after download', async () => {
      stubDocument();

      const artifacts = [makeArtifact()];
      await browserExportSink(artifacts);

      expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledOnce();
    });
  });

  describe('ZIP export', () => {
    it('creates ZIP with multiple artifacts', async () => {
      const { clickSpy } = stubDocument();

      const artifacts = [
        makeArtifact({ fileName: 'frame_0001.png', relativePath: 'idle/frame_0001.png' }),
        makeArtifact({ fileName: 'frame_0002.png', relativePath: 'idle/frame_0002.png' }),
      ];

      const result = await browserExportSink(artifacts, { destination: 'zip', projectName: 'project' });

      expect(result.ok).toBe(true);
      expect(globalThis.URL.createObjectURL).toHaveBeenCalledOnce();
      expect(clickSpy).toHaveBeenCalledOnce();
    });

    it('downloads with sanitized project name as ZIP filename', async () => {
      const { getAnchor } = stubDocument();

      const artifacts = [makeArtifact()];
      await browserExportSink(artifacts, { destination: 'zip', projectName: 'My Character 2' });

      expect(getAnchor().download).toBe('My_Character_2.zip');
    });

    it('defaults to export.zip', async () => {
      const { getAnchor } = stubDocument();

      const artifacts = [makeArtifact()];
      await browserExportSink(artifacts, { destination: 'zip' });

      expect(getAnchor().download).toBe('export.zip');
    });
  });

  describe('folder export', () => {
    it('writes files via showDirectoryPicker', async () => {
      stubDocument();
      const writableClose = vi.fn();
      const writableWrite = vi.fn();
      const writable = { write: writableWrite, close: writableClose };

      const fileHandle = { createWritable: vi.fn(async () => writable) };
      const dirHandle = {
        getDirectoryHandle: vi.fn(async () => dirHandle),
        getFileHandle: vi.fn(async () => fileHandle),
      };
      vi.stubGlobal('window', { showDirectoryPicker: vi.fn(async () => dirHandle) });

      const artifacts = [
        makeArtifact({ relativePath: 'idle/frame_0001.png' }),
        makeArtifact({ relativePath: 'idle/frame_0002.png' }),
      ];

      const result = await browserExportSink(artifacts, { destination: 'folder' });

      expect(result.ok).toBe(true);
      expect(dirHandle.getFileHandle).toHaveBeenCalledTimes(2);
      expect(writableWrite).toHaveBeenCalledTimes(2);
      expect(writableClose).toHaveBeenCalledTimes(2);
    });

    it('returns cancelled when picker is dismissed', async () => {
      stubDocument();
      vi.stubGlobal('window', {
        showDirectoryPicker: vi.fn(async () => { throw new DOMException('Aborted', 'AbortError'); }),
      });

      const artifacts = [makeArtifact()];
      const result = await browserExportSink(artifacts, { destination: 'folder' });

      expect(result.ok).toBe(false);
      expect(result.cancelled).toBe(true);
    });

    it('creates subdirectories from relative paths', async () => {
      stubDocument();
      const writable = { write: vi.fn(), close: vi.fn() };
      const subDirHandle = { getFileHandle: vi.fn(async () => ({ createWritable: vi.fn(async () => writable) })) };
      const dirHandle = {
        getDirectoryHandle: vi.fn(async (name, _opts) => {
          if (name === 'walk') return subDirHandle;
          return dirHandle;
        }),
        getFileHandle: vi.fn(),
      };
      vi.stubGlobal('window', { showDirectoryPicker: vi.fn(async () => dirHandle) });

      const artifacts = [makeArtifact({ relativePath: 'walk/frame_0001.png' })];
      await browserExportSink(artifacts, { destination: 'folder' });

      expect(dirHandle.getDirectoryHandle).toHaveBeenCalledWith('walk', { create: true });
      expect(subDirHandle.getFileHandle).toHaveBeenCalledWith('frame_0001.png', { create: true });
    });
  });

  describe('empty artifacts', () => {
    it('returns ok for empty array', async () => {
      const result = await browserExportSink([]);
      expect(result.ok).toBe(true);
    });
  });

  describe('artifact path safety', () => {
    it.each([
      '../escape.png',
      'idle/../escape.png',
      '/absolute.png',
      'C:/absolute.png',
      'idle\\escape.png',
      'idle//frame.png',
    ])('rejects unsafe path %s before writing', async (relativePath) => {
      await expect(browserExportSink([
        makeArtifact({ relativePath }),
      ], { destination: 'zip' })).rejects.toThrow(/artifact path/);
      expect(globalThis.URL.createObjectURL).not.toHaveBeenCalled();
    });
  });

  describe('legacy direct call (no options)', () => {
    it('downloads single artifact directly without options', async () => {
      const { clickSpy } = stubDocument();

      const artifacts = [makeArtifact()];
      const result = await browserExportSink(artifacts);

      expect(result.ok).toBe(true);
      expect(clickSpy).toHaveBeenCalledOnce();
    });

    it('creates ZIP for multiple artifacts without options', async () => {
      const { clickSpy } = stubDocument();

      const artifacts = [makeArtifact(), makeArtifact()];
      const result = await browserExportSink(artifacts);

      expect(result.ok).toBe(true);
      expect(clickSpy).toHaveBeenCalledOnce();
    });
  });
});
