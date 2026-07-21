import { describe, expect, it } from 'vitest';
import {
  advanceAnimationTransport,
  frameToTime,
  sampleTimeAtFps,
} from '@/domain/animationTransport';
import { ANIMATION_DEFAULTS } from '@/domain/animationDefaults';

describe('frameToTime', () => {
  it('converts frame 0 to 0ms at any fps', () => {
    expect(frameToTime(0, 24)).toBe(0);
    expect(frameToTime(0, 60)).toBe(0);
  });

  it('converts frame 12 at 24fps to 500ms', () => {
    expect(frameToTime(12, 24)).toBe(500);
  });

  it('clamps negative frames to 0', () => {
    expect(frameToTime(-1, 24)).toBe(0);
  });

  it('falls back to default fps when fps is invalid', () => {
    const result = frameToTime(10, 0);
    expect(result).toBeGreaterThan(0);
    expect(result).toBe(frameToTime(10, ANIMATION_DEFAULTS.fps));
  });
});

describe('sampleTimeAtFps', () => {
  it('snaps time to the nearest frame boundary', () => {
    const snapped = sampleTimeAtFps(50, 30);
    expect(snapped).toBe(frameToTime(1, 30));
  });

  it('returns 0 when time has not reached frame 1', () => {
    expect(sampleTimeAtFps(10, 30)).toBe(0);
  });

  it('returns 0 for non-finite time', () => {
    expect(sampleTimeAtFps(NaN, 30)).toBe(0);
  });

  it('returns unchanged time when fps is invalid', () => {
    expect(sampleTimeAtFps(100, 0)).toBe(100);
  });
});

describe('advanceAnimationTransport', () => {
  const baseState = () => ({
    currentTime: 0,
    isPlaying: false,
    loop: false,
    fps: 24,
    speed: 1,
    startFrame: 0,
    endFrame: 24,
    lastTimestamp: null,
  });

  it('does not advance when paused', () => {
    const result = advanceAnimationTransport(
      { ...baseState(), isPlaying: false },
      1000,
    );
    expect(result.advanced).toBe(false);
  });

  it('sets lastTimestamp on first tick without advancing', () => {
    const result = advanceAnimationTransport(
      { ...baseState(), isPlaying: true },
      1000,
    );
    expect(result.advanced).toBe(false);
    expect(result.lastTimestamp).toBe(1000);
  });

  it('advances time on second tick', () => {
    const first = advanceAnimationTransport(
      { ...baseState(), isPlaying: true },
      1000,
    );
    const second = advanceAnimationTransport(first, 1500);
    expect(second.advanced).toBe(true);
    expect(second.currentTime).toBeGreaterThan(0);
  });

  it('stops at end when not looping', () => {
    let state = { ...baseState(), isPlaying: true, loop: false, currentTime: 0, startFrame: 0, endFrame: 1 };
    state = advanceAnimationTransport(state, 0);
    state = advanceAnimationTransport(state, 2000);
    expect(state.isPlaying).toBe(false);
    expect(state.advanced).toBe(true);
  });

  it('loops when loop is enabled', () => {
    let state = { ...baseState(), isPlaying: true, loop: true, startFrame: 0, endFrame: 2 };
    state = advanceAnimationTransport(state, 0);
    state = advanceAnimationTransport(state, 5000);
    expect(state.loops).toBeGreaterThan(0);
    expect(state.isPlaying).toBe(true);
  });

  it('respects speed multiplier', () => {
    const slow = { ...baseState(), isPlaying: true, speed: 0.5 };
    const fast = { ...baseState(), isPlaying: true, speed: 2 };
    const slowFirst = advanceAnimationTransport(slow, 0);
    const fastFirst = advanceAnimationTransport(fast, 0);
    const slowAdv = advanceAnimationTransport(slowFirst, 1000);
    const fastAdv = advanceAnimationTransport(fastFirst, 1000);
    expect(fastAdv.currentTime).toBeGreaterThan(slowAdv.currentTime);
  });

  it('handles non-finite timestamp', () => {
    const result = advanceAnimationTransport(
      { ...baseState(), isPlaying: true, lastTimestamp: 100 },
      NaN,
    );
    expect(result.advanced).toBe(false);
  });
});
