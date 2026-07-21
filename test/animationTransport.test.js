import { describe, expect, it } from 'vitest';
import {
  advanceAnimationTransport,
  frameToTime,
  sampleTimeAtFps,
} from '../src/domain/animationTransport.js';
import { normalizeAnimationClip } from '../src/domain/animationDocument.js';

const state = {
  currentTime: 0,
  lastTimestamp: 0,
  isPlaying: true,
  loop: true,
  speed: 1,
  startFrame: 0,
  endFrame: 24,
  fps: 24,
};

describe('animation transport', () => {
  it('samples display time at FPS without changing transport duration', () => {
    expect(sampleTimeAtFps(149, 10)).toBe(100);
    expect(sampleTimeAtFps(199, 10)).toBe(100);
    expect(sampleTimeAtFps(200, 10)).toBe(200);
  });

  it('advances independently from requestAnimationFrame', () => {
    const next = advanceAnimationTransport(state, 250);
    expect(next.currentTime).toBe(250);
    expect(next.advanced).toBe(true);
  });

  it('counts every loop after a delayed tick', () => {
    const next = advanceAnimationTransport(state, 3250);
    expect(next.currentTime).toBe(250);
    expect(next.loops).toBe(3);
  });

  it('stops exactly at end when looping is disabled', () => {
    const next = advanceAnimationTransport({ ...state, loop: false }, 1250);
    expect(next.currentTime).toBe(1000);
    expect(next.isPlaying).toBe(false);
    expect(next.lastTimestamp).toBeNull();
  });

  it('uses a safe FPS fallback', () => {
    expect(frameToTime(24, 0)).toBe(1000);
  });
});

describe('animation document normalization', () => {
  it('sorts and deduplicates keyframes at load boundary', () => {
    const clip = normalizeAnimationClip({
      tracks: [{
        targetId: 'node',
        property: 'x',
        keyframes: [
          { time: 100, value: 1 },
          { time: -1, value: 2 },
          { time: 0, value: 3 },
          { time: 100, value: 4 },
        ],
      }],
    });
    expect(clip.tracks[0].keyframes).toEqual([
      { time: 0, value: 3 },
      { time: 100, value: 4 },
    ]);
    expect(clip.fps).toBe(24);
    expect(clip.duration).toBe(2000);
  });
});
