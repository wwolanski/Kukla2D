import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportToSpine } from '../src/io/exportSpine.js';

const mocks = vi.hoisted(() => {
  let lastInstance = null;
  return {
    getLastZip: () => lastInstance,
    setLastZip: (z) => { lastInstance = z; },
    file: vi.fn(),
    folder: vi.fn(() => ({ file: vi.fn() })),
    generateAsync: vi.fn().mockResolvedValue(new Blob([], { type: 'application/zip' })),
  };
});

vi.mock('jszip', () => {
  return {
    default: vi.fn().mockImplementation(function () {
      mocks.file = vi.fn();
      mocks.folder = vi.fn(() => ({ file: vi.fn() }));
      mocks.generateAsync = vi.fn().mockResolvedValue(new Blob([], { type: 'application/zip' }));
      this.file = mocks.file;
      this.folder = mocks.folder;
      this.generateAsync = mocks.generateAsync;
      mocks.setLastZip(this);
    }),
  };
});

globalThis.fetch = vi.fn().mockResolvedValue({
  blob: vi.fn().mockResolvedValue(new Blob(['img'], { type: 'image/png' })),
});

function makeProject() {
  return {
    canvas: { width: 800, height: 600 },
    nodes: [
      {
        id: 'g1',
        type: 'group',
        name: 'Arm',
        parent: null,
        transform: { x: 100, y: 100, pivotX: 0, pivotY: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      },
      {
        id: 'g2',
        type: 'group',
        name: 'Forearm',
        parent: 'g1',
        transform: { x: 50, y: 0, pivotX: 0, pivotY: 0, rotation: 45, scaleX: 1, scaleY: 1 },
      },
      {
        id: 'p1',
        type: 'part',
        name: 'UpperArm',
        parent: 'g1',
        transform: { x: 0, y: 0, pivotX: 0, pivotY: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        imageWidth: 100,
        imageHeight: 50,
      },
      {
        id: 'p2',
        type: 'part',
        name: 'LowerArm',
        parent: 'g2',
        transform: { x: 0, y: 0, pivotX: 0, pivotY: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        imageWidth: 80,
        imageHeight: 40,
      },
    ],
    textures: [
      { id: 'p1', source: 'data:image/png;base64,abc' },
      { id: 'p2', source: 'data:image/png;base64,def' },
    ],
    animations: [
      {
        name: 'Wave',
        tracks: [
          {
            targetId: 'g2',
            property: 'rotation',
            keyframes: [
              { time: 0, value: 45, easing: 'linear' },
              { time: 500, value: -30, easing: 'ease-in' },
            ],
          },
          {
            targetId: 'p1',
            property: 'opacity',
            keyframes: [
              { time: 0, value: 1, easing: 'linear' },
              { time: 500, value: 0.5, easing: 'stepped' },
            ],
          },
        ],
      },
    ],
  };
}

describe('exportToSpine', () => {
  beforeEach(() => {
    globalThis.fetch.mockClear();
    mocks.file.mockClear();
    mocks.folder.mockClear();
    mocks.generateAsync.mockClear();
  });

  it('returns a blob and writes skeleton.json', async () => {
    const project = makeProject();
    const result = await exportToSpine({ project, onProgress: vi.fn() });

    expect(result).toBeDefined();
    expect(mocks.generateAsync).toHaveBeenCalledWith({ type: 'blob' });
    expect(mocks.file).toHaveBeenCalled();
    expect(mocks.file.mock.calls[0][0]).toBe('skeleton.json');
  });

  it('generates valid skeleton with expected bone names', async () => {
    const project = makeProject();
    await exportToSpine({ project, onProgress: vi.fn() });

    const skeletonJson = JSON.parse(mocks.file.mock.calls[0][1]);
    const boneNames = skeletonJson.bones.map(b => b.name);
    expect(boneNames).toContain('root');
    expect(boneNames).toContain('Arm');
    expect(boneNames).toContain('Forearm');
  });

  it('generates slots for parts', async () => {
    const project = makeProject();
    await exportToSpine({ project, onProgress: vi.fn() });

    const skeletonJson = JSON.parse(mocks.file.mock.calls[0][1]);
    expect(skeletonJson.slots.length).toBe(2);
    expect(skeletonJson.slots.map(s => s.name)).toContain('UpperArm');
    expect(skeletonJson.slots.map(s => s.name)).toContain('LowerArm');
  });

  it('includes animation data with translate and rotate keys', async () => {
    const project = makeProject();
    await exportToSpine({ project, onProgress: vi.fn() });

    const skeletonJson = JSON.parse(mocks.file.mock.calls[0][1]);
    const anim = skeletonJson.animations.Wave;
    expect(anim).toBeDefined();
    expect(anim.bones.Forearm).toBeDefined();
    expect(anim.bones.Forearm.rotate).toBeDefined();
    expect(anim.bones.Forearm.rotate.length).toBe(2);
    expect(anim.slots.UpperArm).toBeDefined();
    expect(anim.slots.UpperArm.rgba).toBeDefined();
  });

  it('applies stepped curve correctly', async () => {
    const project = makeProject();
    await exportToSpine({ project, onProgress: vi.fn() });

    const skeletonJson = JSON.parse(mocks.file.mock.calls[0][1]);
    const opacityKey = skeletonJson.animations.Wave.slots.UpperArm.rgba[1];
    expect(opacityKey.curve).toBe('stepped');
  });

  it('applies ease-in curve correctly', async () => {
    const project = makeProject();
    await exportToSpine({ project, onProgress: vi.fn() });

    const skeletonJson = JSON.parse(mocks.file.mock.calls[0][1]);
    const rotateKey = skeletonJson.animations.Wave.bones.Forearm.rotate[1];
    expect(rotateKey.curve).toEqual([0.42, 0, 1, 1]);
  });

  it('sets skeleton version and dimensions', async () => {
    const project = makeProject();
    await exportToSpine({ project, onProgress: vi.fn() });

    const skeletonJson = JSON.parse(mocks.file.mock.calls[0][1]);
    expect(skeletonJson.skeleton.spine).toBe('4.0');
    expect(skeletonJson.skeleton.width).toBe(800);
    expect(skeletonJson.skeleton.height).toBe(600);
  });

  it('creates images folder and fetches textures', async () => {
    const project = makeProject();
    await exportToSpine({ project, onProgress: vi.fn() });

    expect(mocks.folder).toHaveBeenCalledWith('images');
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('handles missing textures gracefully', async () => {
    const project = makeProject();
    project.textures = [];
    const result = await exportToSpine({ project, onProgress: vi.fn() });
    expect(result).toBeDefined();
  });

  it('calls onProgress callbacks', async () => {
    const project = makeProject();
    const onProgress = vi.fn();
    await exportToSpine({ project, onProgress });

    expect(onProgress).toHaveBeenCalledWith('Preparing skeleton data...');
    expect(onProgress).toHaveBeenCalledWith('Collecting textures...');
    expect(onProgress).toHaveBeenCalledWith('Generating ZIP...');
  });
});
