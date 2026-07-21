import { describe, expect, it } from 'vitest';
import { EditorEngine } from '../packages/engine/src/editorEngine.js';
import {
  BrowserTaskService,
  parseTaskMessage,
} from '../packages/platform-browser/src/taskService.js';
import { createManualPosePhysicsRuntime } from '../src/runtime/physics/manualPosePhysics.js';
import { stepPhysicsResult } from '../src/runtime/physics/solver.js';
import { computeBoneWorldMatricesResult } from '../src/runtime/skeleton.js';

class FakeWorker {
  listeners = new Set();
  messages = [];
  terminated = false;

  addEventListener(type, handler) {
    if (type === 'message') this.listeners.add(handler);
  }

  removeEventListener(type, handler) {
    if (type === 'message') this.listeners.delete(handler);
  }

  postMessage(message) {
    this.messages.push(message);
  }

  terminate() {
    this.terminated = true;
  }
}

describe('phase 12 runtime contracts', () => {
  it('reports a bone-parent cycle without recursive failure', () => {
    const setup = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, shearX: 0, shearY: 0, length: 1 };
    const result = computeBoneWorldMatricesResult([
      { id: 'a', name: 'A', parentId: 'b', setup },
      { id: 'b', name: 'B', parentId: 'a', setup },
    ]);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'PARENT_CYCLE' }));
    expect(result.matrices.size).toBe(2);
  });

  it('rejects invalid physics topology before mutation', () => {
    const rig = {
      id: 'invalid',
      name: 'Invalid',
      particles: [{ id: 'root', x: 0, y: 0, prevX: 0, prevY: 0, mass: 1, damping: 1, pinned: true }],
      links: [{ fromParticleId: 'root', toParticleId: 'missing', restLength: 1, stiffness: 1 }],
      outputs: [],
      gravity: { x: 0, y: -1 },
      wind: { x: 0, y: 0 },
      iterations: 1,
      tags: [],
    };

    const result = stepPhysicsResult(rig, 1 / 60);
    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual({ code: 'MISSING_LINK_PARTICLE', particleId: 'missing' });
    expect(rig._accumulator).toBeUndefined();
  });

  it('narrows every Worker message variant and rejects malformed data', () => {
    expect(parseTaskMessage({ type: 'progress', data: { requestId: 'r1', progress: 0.5 } })).toMatchObject({
      ok: true,
      message: { type: 'progress' },
    });
    expect(parseTaskMessage({ type: 'result', data: { requestId: 'r1', projectRevision: 1, data: {} } })).toMatchObject({
      ok: true,
      message: { type: 'result' },
    });
    expect(parseTaskMessage({ type: 'error', data: { requestId: 'r1', code: 'FAILED', message: 'Failed', retryable: false } })).toMatchObject({
      ok: true,
      message: { type: 'error' },
    });
    expect(parseTaskMessage({ type: 'progress', data: { requestId: 'r1', progress: 2 } })).toEqual({
      ok: false,
      error: { code: 'INVALID_MESSAGE', message: 'Worker progress message is invalid' },
    });
  });

  it('settles pending tasks and terminates workers on disposal', async () => {
    const worker = new FakeWorker();
    const service = new BrowserTaskService({ workerFactory: () => worker });
    const pending = service.dispatch({ requestId: 'r1', kind: 'mesh.generate', projectRevision: 1, payload: {} });

    service.dispose();

    await expect(pending).rejects.toMatchObject({ state: 'disposed' });
    expect(worker.terminated).toBe(true);
    expect(service.state).toBe('disposed');
    expect(service.tasks.size).toBe(0);
  });

  it('makes stale engine revisions and disposal explicit', () => {
    const scheduled = new Map();
    const cancelled = [];
    let nextId = 1;
    const engine = new EditorEngine({
      request(callback) {
        const id = nextId++;
        scheduled.set(id, callback);
        return id;
      },
      cancel(id) {
        cancelled.push(id);
        scheduled.delete(id);
      },
    });
    const project = { nodes: [] };

    expect(engine.setProject(project, 2)).toMatchObject({ ok: true });
    expect(engine.setProject(project, 1)).toEqual({ ok: false, state: 'stale-revision', currentRevision: 2 });
    engine.start({ now: () => 0 }, { frame: () => undefined });
    engine.dispose();

    expect(engine.state).toBe('disposed');
    expect(cancelled).toEqual([1]);
    expect(engine.setPlayback({ playing: true, currentTime: 0, loop: true, speed: 1 })).toEqual({
      ok: false,
      state: 'disposed',
    });
  });

  it('reports manual physics runtime disposal and makes it idempotent', () => {
    const runtime = createManualPosePhysicsRuntime();
    runtime.dispose();
    runtime.dispose();

    expect(runtime.disposed).toBe(true);
    expect(runtime.evaluate({
      project: { bones: [], physics_groups: [], physicsRules: [] },
      effectiveBones: [],
      timestamp: 0,
      enabled: true,
    })).toEqual({ state: 'disposed', active: false, overrides: null, diagnostics: [] });
  });
});
