// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

class MockAudioBuffer {
  constructor() { this.duration = 1.5; }
}
class MockAudioContext {
  constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; }
  decodeAudioData() { return Promise.resolve(new MockAudioBuffer()); }
  resume() { return Promise.resolve(); }
}

beforeEach(() => {
  globalThis.AudioContext = MockAudioContext;
  globalThis.URL.createObjectURL = () => 'blob:mock';
  globalThis.URL.revokeObjectURL = vi.fn();
  globalThis.fetch = vi.fn(() => Promise.resolve({
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
  }));
});

describe('decodeAudioFile', () => {
  it('decodes audio file and returns buffer with blobUrl', async () => {
    const { decodeAudioFile } = await import('@/features/timeline/infrastructure/audioDecode.js');
    const file = new File(['dummy'], 'test.mp3', { type: 'audio/mpeg' });
    const result = await decodeAudioFile(file);

    expect(result.buffer).toBeDefined();
    expect(result.buffer.duration).toBe(1.5);
    expect(result.blobUrl).toBe('blob:mock');
    expect(result.durationMs).toBe(1500);
    expect(result.error).toBeUndefined();
  });

  it('uses provided audioContext', async () => {
    const { decodeAudioFile } = await import('@/features/timeline/infrastructure/audioDecode.js');
    const mockDecode = vi.fn(() => Promise.resolve({ duration: 2 }));
    const ctx = { decodeAudioData: mockDecode };
    const file = new File(['dummy'], 'test.mp3', { type: 'audio/mpeg' });
    const result = await decodeAudioFile(file, ctx);

    expect(mockDecode).toHaveBeenCalled();
    expect(result.buffer.duration).toBe(2);
  });
});
