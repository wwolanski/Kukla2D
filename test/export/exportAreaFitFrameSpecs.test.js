import { describe, expect, it } from 'vitest';
import { buildExportAreaFitFrameSpecs } from '@/features/export/domain/exportAreaFitFrameSpecs';

describe('buildExportAreaFitFrameSpecs', () => {
  it('returns staging sample for null project', () => {
    expect(buildExportAreaFitFrameSpecs(null)).toEqual([{ animationId: null, timeMs: 0 }]);
  });

  it('returns staging sample when animations missing/empty', () => {
    expect(buildExportAreaFitFrameSpecs({})).toEqual([{ animationId: null, timeMs: 0 }]);
    expect(buildExportAreaFitFrameSpecs({ animations: [] }))
      .toEqual([{ animationId: null, timeMs: 0 }]);
  });

  it('samples authored FPS cadence plus endpoint for 1s/10FPS', () => {
    const project = {
      animations: [{ id: 'a1', name: 'idle', duration: 1000, fps: 10 }],
    };
    const specs = buildExportAreaFitFrameSpecs(project);
    expect(specs.map((s) => s.timeMs)).toEqual([0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]);
    expect(specs.every((s) => s.animationId === 'a1')).toBe(true);
  });

  it('dedupes endpoint when duration is an exact tick', () => {
    const project = {
      animations: [{ id: 'a1', name: 'loop', duration: 1000, fps: 1 }],
    };
    const specs = buildExportAreaFitFrameSpecs(project);
    // ticks: 0; endpoint 1000 is not a 1s tick at fps=1? interval=1000, maxFrame=floor((1000-eps)/1000)=0 → only 0, then endpoint 1000 added.
    expect(specs.map((s) => s.timeMs)).toEqual([0, 1000]);
  });

  it('does not duplicate endpoint when it lands on cadence boundary', () => {
    // duration 2000, fps 2 → interval 500; ticks 0,500,1000,1500; endpoint 2000 distinct
    const project = {
      animations: [{ id: 'a1', name: 'x', duration: 2000, fps: 2 }],
    };
    const specs = buildExportAreaFitFrameSpecs(project);
    expect(specs.map((s) => s.timeMs)).toEqual([0, 500, 1000, 1500, 2000]);
  });

  it('handles fractional duration with endpoint distinct', () => {
    const project = {
      animations: [{ id: 'a1', name: 'x', duration: 950, fps: 10 }],
    };
    const specs = buildExportAreaFitFrameSpecs(project);
    expect(specs.map((s) => s.timeMs)).toEqual([0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]);
  });

  it('preserves animation order across two clips of different FPS', () => {
    const project = {
      animations: [
        { id: 'a1', name: 'idle', duration: 500, fps: 5 },
        { id: 'a2', name: 'walk', duration: 1000, fps: 2 },
      ],
    };
    const specs = buildExportAreaFitFrameSpecs(project);
    const ids = specs.map((s) => s.animationId);
    expect(ids).toEqual([
      ...Array(4).fill('a1'),
      ...Array(3).fill('a2'),
    ]);
    expect(specs.filter((s) => s.animationId === 'a1').map((s) => s.timeMs))
      .toEqual([0, 200, 400, 500]);
    expect(specs.filter((s) => s.animationId === 'a2').map((s) => s.timeMs))
      .toEqual([0, 500, 1000]);
  });

  it('samples only the requested active animation', () => {
    const project = {
      animations: [
        { id: 'idle', duration: 1000, fps: 10 },
        { id: 'walk', duration: 500, fps: 5 },
      ],
    };
    const specs = buildExportAreaFitFrameSpecs(project, { animationId: 'walk' });
    expect(specs).toEqual([
      { animationId: 'walk', timeMs: 0 },
      { animationId: 'walk', timeMs: 200 },
      { animationId: 'walk', timeMs: 400 },
      { animationId: 'walk', timeMs: 500 },
    ]);
  });

  it('falls back to staging when requested animation no longer exists', () => {
    const project = { animations: [{ id: 'idle', duration: 1000, fps: 10 }] };
    expect(buildExportAreaFitFrameSpecs(project, { animationId: 'deleted' }))
      .toEqual([{ animationId: null, timeMs: 0 }]);
  });

  it('includes exact endpoint sample', () => {
    const project = {
      animations: [{ id: 'a1', name: 'x', duration: 1234, fps: 30 }],
    };
    const specs = buildExportAreaFitFrameSpecs(project);
    expect(specs[specs.length - 1]).toEqual({ animationId: 'a1', timeMs: 1234 });
  });

  it('falls back to [0] when fps invalid and duration positive', () => {
    const project = {
      animations: [{ id: 'a1', name: 'x', duration: 1000, fps: 0 }],
    };
    const specs = buildExportAreaFitFrameSpecs(project);
    expect(specs.map((s) => s.timeMs)).toEqual([0, 1000]);
  });

  it('falls back to [0] when duration zero/invalid', () => {
    const project = {
      animations: [{ id: 'a1', name: 'x', duration: 0, fps: 30 }],
    };
    const specs = buildExportAreaFitFrameSpecs(project);
    expect(specs.map((s) => s.timeMs)).toEqual([0]);
  });

  it('returns a frozen array', () => {
    const project = {
      animations: [{ id: 'a1', name: 'x', duration: 100, fps: 10 }],
    };
    const specs = buildExportAreaFitFrameSpecs(project);
    expect(Object.isFrozen(specs)).toBe(true);
  });

  it('does not mutate the input animations', () => {
    const project = {
      animations: [{ id: 'a1', name: 'x', duration: 1000, fps: 10 }],
    };
    const snapshot = JSON.parse(JSON.stringify(project.animations));
    buildExportAreaFitFrameSpecs(project);
    expect(project.animations).toEqual(snapshot);
  });

  it('returns staging sample when no animations resolve to specs', () => {
    const project = { animations: [null, { duration: 'bad' }] };
    expect(buildExportAreaFitFrameSpecs(project)).toEqual([{ animationId: null, timeMs: 0 }]);
  });
});
