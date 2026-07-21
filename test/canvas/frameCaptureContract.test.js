import { describe, expect, it } from 'vitest';
import {
  createFrameCaptureRequest,
  createFrameCaptureSuccess,
  createFrameCaptureError,
  isFrameCaptureRequest,
  isFrameCaptureResult,
} from '@/features/canvas/domain/frameCaptureContract.js';

describe('frameCaptureContract', () => {
  describe('createFrameCaptureRequest (K5)', () => {
    it('builds a valid request from minimal input', () => {
      const req = createFrameCaptureRequest({
        animationId: 'anim-1',
        timeMs: 500,
        width: 800,
        height: 600,
      });

      expect(req.animationId).toBe('anim-1');
      expect(req.timeMs).toBe(500);
      expect(req.width).toBe(800);
      expect(req.height).toBe(600);
      expect(req.format).toBe('png');
      expect(req.quality).toBe(0.92);
      expect(req.background.enabled).toBe(true);
      expect(req.background.color).toBe('#ffffff');
      expect(req.crop).toBeNull();
    });

    it('accepts legacy field names (animId, exportWidth, exportHeight, cropOffset)', () => {
      const req = createFrameCaptureRequest({
        animId: 'anim-2',
        timeMs: 0,
        exportWidth: 1024,
        exportHeight: 768,
        format: 'webp',
        quality: 0.8,
        bgEnabled: false,
        bgColor: '#000000',
        cropOffset: { x: 10, y: 20 },
      });

      expect(req.animationId).toBe('anim-2');
      expect(req.width).toBe(1024);
      expect(req.height).toBe(768);
      expect(req.format).toBe('webp');
      expect(req.quality).toBe(0.8);
      expect(req.background.enabled).toBe(false);
      expect(req.crop).toEqual({ x: 10, y: 20 });
    });

    it('accepts background as object', () => {
      const req = createFrameCaptureRequest({
        timeMs: 0,
        width: 100,
        height: 100,
        background: { enabled: false, color: '#ff0000' },
      });

      expect(req.background.enabled).toBe(false);
      expect(req.background.color).toBe('#ff0000');
    });

    it('throws on negative timeMs', () => {
      expect(() => createFrameCaptureRequest({ timeMs: -1, width: 100, height: 100 }))
        .toThrow(RangeError);
    });

    it('throws on zero width', () => {
      expect(() => createFrameCaptureRequest({ timeMs: 0, width: 0, height: 100 }))
        .toThrow(RangeError);
    });

    it('throws on zero height', () => {
      expect(() => createFrameCaptureRequest({ timeMs: 0, width: 100, height: 0 }))
        .toThrow(RangeError);
    });

    it('throws on invalid format', () => {
      expect(() => createFrameCaptureRequest({ timeMs: 0, width: 100, height: 100, format: 'bmp' }))
        .toThrow(RangeError);
    });

    it('throws on quality out of range', () => {
      expect(() => createFrameCaptureRequest({ timeMs: 0, width: 100, height: 100, quality: 2 }))
        .toThrow(RangeError);
    });

    it('throws on non-object input', () => {
      expect(() => createFrameCaptureRequest(null)).toThrow(TypeError);
      expect(() => createFrameCaptureRequest('string')).toThrow(TypeError);
    });

    it('defaults animationId to null when not provided', () => {
      const req = createFrameCaptureRequest({ timeMs: 0, width: 100, height: 100 });
      expect(req.animationId).toBeNull();
    });
  });

  describe('isFrameCaptureRequest', () => {
    it('returns true for a valid K5 request', () => {
      const req = createFrameCaptureRequest({ timeMs: 0, width: 100, height: 100 });
      expect(isFrameCaptureRequest(req)).toBe(true);
    });

    it('returns false for plain objects missing K5 fields', () => {
      expect(isFrameCaptureRequest({})).toBe(false);
      expect(isFrameCaptureRequest({ animId: 'a', timeMs: 0 })).toBe(false);
    });

    it('returns false for null/undefined', () => {
      expect(isFrameCaptureRequest(null)).toBe(false);
      expect(isFrameCaptureRequest(undefined)).toBe(false);
    });
  });

  describe('K6 result factories', () => {
    it('creates a success result', () => {
      const result = createFrameCaptureSuccess('data:image/png;base64,abc', 800, 600);
      expect(result.ok).toBe(true);
      expect(result.dataUrl).toBe('data:image/png;base64,abc');
      expect(result.width).toBe(800);
      expect(result.height).toBe(600);
    });

    it('creates an error result', () => {
      const result = createFrameCaptureError('NO_CANVAS', 'Canvas not found');
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe('NO_CANVAS');
      expect(result.error.message).toBe('Canvas not found');
    });

    it('isFrameCaptureResult detects both shapes', () => {
      expect(isFrameCaptureResult(createFrameCaptureSuccess('x', 1, 1))).toBe(true);
      expect(isFrameCaptureResult(createFrameCaptureError('E', 'msg'))).toBe(true);
      expect(isFrameCaptureResult(null)).toBe(false);
      expect(isFrameCaptureResult({})).toBe(false);
    });
  });
});
