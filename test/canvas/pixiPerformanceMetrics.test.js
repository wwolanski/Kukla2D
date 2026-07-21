import { describe, it, expect } from 'vitest';
import {
  createPerformanceCounters,
  incrementCounter,
  recordTiming,
  snapshotStats,
  resetCounters,
  measureSync,
  createRenderCounter,
} from '@/features/canvas/domain/pixiPerformanceMetrics.js';

describe('pixiPerformanceMetrics', () => {
  describe('createPerformanceCounters', () => {
    it('creates counters with all fields at zero', () => {
      const c = createPerformanceCounters();
      expect(c.pointerEventsHandled).toBe(0);
      expect(c.pointerHandlerTotalMs).toBe(0);
      expect(c.renderCount).toBe(0);
      expect(c.renderTotalMs).toBe(0);
      expect(c.gpuUploadCount).toBe(0);
      expect(c.overlayRenderCount).toBe(0);
    });

    it('returns a new object each call', () => {
      const a = createPerformanceCounters();
      const b = createPerformanceCounters();
      expect(a).not.toBe(b);
    });
  });

  describe('incrementCounter', () => {
    it('increments by 1 by default', () => {
      const c = createPerformanceCounters();
      incrementCounter(c, 'renderCount');
      expect(c.renderCount).toBe(1);
      incrementCounter(c, 'renderCount');
      expect(c.renderCount).toBe(2);
    });

    it('increments by custom delta', () => {
      const c = createPerformanceCounters();
      incrementCounter(c, 'gpuUploadCount', 5);
      expect(c.gpuUploadCount).toBe(5);
    });
  });

  describe('recordTiming', () => {
    it('accumulates timing values', () => {
      const c = createPerformanceCounters();
      recordTiming(c, 'renderTotalMs', 10.5);
      recordTiming(c, 'renderTotalMs', 5.3);
      expect(c.renderTotalMs).toBeCloseTo(15.8);
    });

    it('works with pointerHandlerTotalMs', () => {
      const c = createPerformanceCounters();
      recordTiming(c, 'pointerHandlerTotalMs', 1.2);
      expect(c.pointerHandlerTotalMs).toBeCloseTo(1.2);
    });
  });

  describe('snapshotStats', () => {
    it('returns a PixiRuntimeStats-compatible object', () => {
      const c = createPerformanceCounters();
      c.pointerEventsHandled = 42;
      c.renderCount = 10;
      c.renderTotalMs = 100;
      c.gpuUploadCount = 5;

      const stats = snapshotStats(c);
      expect(stats).toEqual({
        pointerEventsHandled: 42,
        renderCount: 10,
        gpuUploadCount: 5,
        lastFrameDurationMs: 10,
      });
    });

    it('returns 0 lastFrameDurationMs when renderCount is 0', () => {
      const c = createPerformanceCounters();
      const stats = snapshotStats(c);
      expect(stats.lastFrameDurationMs).toBe(0);
    });

    it('returns a new object (no mutation)', () => {
      const c = createPerformanceCounters();
      c.renderCount = 5;
      const stats = snapshotStats(c);
      stats.renderCount = 999;
      expect(c.renderCount).toBe(5);
    });
  });

  describe('resetCounters', () => {
    it('resets all counters to zero', () => {
      const c = createPerformanceCounters();
      c.pointerEventsHandled = 100;
      c.renderCount = 50;
      c.gpuUploadCount = 25;
      c.renderTotalMs = 200;
      c.pointerHandlerTotalMs = 50;
      c.overlayRenderCount = 10;

      resetCounters(c);

      expect(c.pointerEventsHandled).toBe(0);
      expect(c.renderCount).toBe(0);
      expect(c.gpuUploadCount).toBe(0);
      expect(c.renderTotalMs).toBe(0);
      expect(c.pointerHandlerTotalMs).toBe(0);
      expect(c.overlayRenderCount).toBe(0);
    });
  });

  describe('measureSync', () => {
    it('returns the function result', () => {
      const result = measureSync(() => 42, () => {});
      expect(result).toBe(42);
    });

    it('reports timing to callback', () => {
      let reported = -1;
      measureSync(() => 'hello', (dt) => { reported = dt; });
      expect(reported).toBeGreaterThanOrEqual(0);
    });

    it('reports timing even if function throws', () => {
      let reported = -1;
      try {
        measureSync(() => { throw new Error('boom'); }, (dt) => { reported = dt; });
      } catch (_) { /* noop */ }
      expect(reported).toBeGreaterThanOrEqual(0);
    });
  });

  describe('createRenderCounter', () => {
    it('starts at 0', () => {
      const rc = createRenderCounter();
      expect(rc.count).toBe(0);
    });

    it('increments', () => {
      const rc = createRenderCounter();
      rc.increment();
      rc.increment();
      expect(rc.count).toBe(2);
    });

    it('resets', () => {
      const rc = createRenderCounter();
      rc.increment();
      rc.reset();
      expect(rc.count).toBe(0);
    });
  });
});
