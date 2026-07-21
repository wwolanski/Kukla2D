import { describe, expect, it } from 'vitest';
import {
  activateAnimationSession,
  synchronizeAnimationSession,
  resetAnimationSession,
  selectAnimationSessionSnapshot,
} from '../../src/domain/animationSession.js';

const CLIP_24FPS = {
  id: 'clip-1',
  name: 'Walk',
  duration: 2000,
  fps: 24,
  tracks: [],
};

const CLIP_30FPS = {
  id: 'clip-2',
  name: 'Run',
  duration: 1000,
  fps: 30,
  tracks: [],
};

describe('animation session', () => {
  describe('activateAnimationSession', () => {
    it('creates session from clip', () => {
      const session = activateAnimationSession(CLIP_24FPS);
      expect(session.activeAnimationId).toBe('clip-1');
      expect(session.currentTimeMs).toBe(0);
      expect(session.playing).toBe(false);
      expect(session.loop).toBe(true);
      expect(session.loopStartFrame).toBe(0);
      expect(session.loopEndFrame).toBe(48);
      expect(session.speed).toBe(1);
      expect(session.loopKeyframes).toBe(true);
      expect(session.draftPose).toBeInstanceOf(Map);
    });

    it('returns idle when clip is null', () => {
      const session = activateAnimationSession(null);
      expect(session.activeAnimationId).toBeNull();
      expect(session.loopEndFrame).toBe(48);
    });

    it('returns idle when clip is undefined', () => {
      const session = activateAnimationSession(undefined);
      expect(session.activeAnimationId).toBeNull();
    });

    it('derives loop window from duration and fps', () => {
      const session = activateAnimationSession(CLIP_30FPS);
      // 1000ms / 1000 * 30 = 30 frames
      expect(session.loopStartFrame).toBe(0);
      expect(session.loopEndFrame).toBe(30);
    });

    it('handles missing fps', () => {
      const session = activateAnimationSession({ id: 'x', duration: 1000 });
      // default 24fps: 1000/1000*24 = 24
      expect(session.loopEndFrame).toBe(24);
    });

    it('handles missing duration', () => {
      const session = activateAnimationSession({ id: 'x', fps: 30 });
      // default 2000ms: 2000/1000*30 = 60
      expect(session.loopEndFrame).toBe(60);
    });

    it('preserves canonical zero duration as a one-frame loop', () => {
      const session = activateAnimationSession({ id: 'x', duration: 0, fps: 30 });
      expect(session.loopEndFrame).toBe(1);
    });
  });

  describe('resetAnimationSession', () => {
    it('returns idle state', () => {
      const session = resetAnimationSession();
      expect(session.activeAnimationId).toBeNull();
      expect(session.currentTimeMs).toBe(0);
      expect(session.playing).toBe(false);
      expect(session.loop).toBe(true);
      expect(session.loopStartFrame).toBe(0);
      expect(session.loopEndFrame).toBe(48);
      expect(session.speed).toBe(1);
      expect(session.loopKeyframes).toBe(true);
      expect(session.draftPose).toBeInstanceOf(Map);
    });

    it('idle has stable shape', () => {
      const a = resetAnimationSession();
      const b = resetAnimationSession();
      expect(a).toEqual(b);
    });
  });

  describe('synchronizeAnimationSession', () => {
    it('updates loop window from new clip', () => {
      const session = activateAnimationSession(CLIP_24FPS);
      const synced = synchronizeAnimationSession(session, CLIP_30FPS);
      expect(synced.loopStartFrame).toBe(0);
      expect(synced.loopEndFrame).toBe(30);
      expect(synced.activeAnimationId).toBe('clip-2');
    });

    it('clamps playhead past end', () => {
      const session = {
        ...activateAnimationSession(CLIP_24FPS),
        currentTimeMs: 5000,
        loopStartFrame: 0,
        loopEndFrame: 48,
      };
      const synced = synchronizeAnimationSession(session, CLIP_24FPS);
      // endMs = frameToTime(48, 24) = 2000
      expect(synced.currentTimeMs).toBe(2000);
    });

    it('clamps playhead below start', () => {
      const session = {
        ...activateAnimationSession(CLIP_24FPS),
        currentTimeMs: -100,
        loopStartFrame: 0,
        loopEndFrame: 48,
      };
      const synced = synchronizeAnimationSession(session, CLIP_24FPS);
      expect(synced.currentTimeMs).toBe(0);
    });

    it('clamps playhead to end when clip shortens', () => {
      const session = {
        ...activateAnimationSession(CLIP_24FPS),
        currentTimeMs: 1500,
      };
      // CLIP_30FPS: 1000ms, 30fps → endFrame=30, endMs=1000
      const synced = synchronizeAnimationSession(session, CLIP_30FPS);
      expect(synced.loopEndFrame).toBe(30);
      expect(synced.currentTimeMs).toBe(1000);
    });

    it('returns session unchanged when clip is null', () => {
      const session = activateAnimationSession(CLIP_24FPS);
      const synced = synchronizeAnimationSession(session, null);
      expect(synced).toBe(session);
    });

    it('preserves playing state', () => {
      const session = {
        ...activateAnimationSession(CLIP_24FPS),
        playing: true,
      };
      const synced = synchronizeAnimationSession(session, CLIP_30FPS);
      expect(synced.playing).toBe(true);
    });

    it('preserves speed', () => {
      const session = {
        ...activateAnimationSession(CLIP_24FPS),
        speed: 2,
      };
      const synced = synchronizeAnimationSession(session, CLIP_30FPS);
      expect(synced.speed).toBe(2);
    });
  });

  describe('selectAnimationSessionSnapshot', () => {
    it('returns K4 shape', () => {
      const session = activateAnimationSession(CLIP_24FPS);
      const snapshot = selectAnimationSessionSnapshot(session);
      expect(snapshot).toEqual({
        activeAnimationId: 'clip-1',
        currentTimeMs: 0,
        playing: false,
        loop: true,
        loopStartFrame: 0,
        loopEndFrame: 48,
        speed: 1,
        loopKeyframes: true,
        draftPose: session.draftPose,
      });
    });

    it('snapshot reflects playing state', () => {
      const session = { ...activateAnimationSession(CLIP_24FPS), playing: true };
      const snapshot = selectAnimationSessionSnapshot(session);
      expect(snapshot.playing).toBe(true);
    });
  });
});
