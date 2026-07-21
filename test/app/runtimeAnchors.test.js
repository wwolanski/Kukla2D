import { describe, expect, it, vi } from 'vitest';
import { BrowserTaskService } from '../../packages/platform-browser/src/taskService.js';
import { loadAnimationListPanel, loadTimelinePanel } from '../../src/app/layout/components/editorWorkspaceLazyLoaders.js';

vi.mock('@/features/timeline', () => ({
  TimelinePanel: 'timeline-panel',
  AnimationListPanel: 'animation-list-panel',
}));

class FakeWorker {
  constructor() {
    this.listeners = new Set();
    this.messages = [];
    this.removedListeners = [];
  }

  addEventListener(type, handler) {
    if (type === 'message') this.listeners.add(handler);
  }

  removeEventListener(type, handler) {
    if (type === 'message') {
      this.removedListeners.push(handler);
      this.listeners.delete(handler);
    }
  }

  postMessage(message, transferables) {
    this.messages.push({ message, transferables });
  }

  emit(data) {
    for (const handler of this.listeners) handler({ data });
  }
}

function createTaskService(worker) {
  const service = new BrowserTaskService();
  service.getWorker = () => worker;
  return service;
}

describe('runtime anchors', () => {
  it('loads timeline lazy targets through their named exports', async () => {
    await expect(loadTimelinePanel()).resolves.toEqual({ default: 'timeline-panel' });
    await expect(loadAnimationListPanel()).resolves.toEqual({ default: 'animation-list-panel' });
  });

  it('settles worker result and removes stored listener/task', async () => {
    const worker = new FakeWorker();
    const service = createTaskService(worker);
    const task = service.dispatch({ requestId: 'r1', kind: 'mesh.generate', projectRevision: 3, payload: {} });
    const handler = service.tasks.get('r1').handler;

    worker.emit({ type: 'result', data: { requestId: 'r1', projectRevision: 3, data: { mesh: 'ok' } } });

    await expect(task).resolves.toEqual({ requestId: 'r1', projectRevision: 3, data: { mesh: 'ok' } });
    expect(worker.removedListeners).toEqual([handler]);
    expect(service.tasks.has('r1')).toBe(false);
  });

  it('rejects stale/error results and cancel removes same stored listener', async () => {
    const staleWorker = new FakeWorker();
    const staleService = createTaskService(staleWorker);
    const staleTask = staleService.dispatch({ requestId: 'r2', kind: 'mesh.generate', projectRevision: 3, payload: {} });
    const staleHandler = staleService.tasks.get('r2').handler;
    staleWorker.emit({ type: 'result', data: { requestId: 'r2', projectRevision: 2, data: {} } });
    await expect(staleTask).rejects.toThrow('Stale revision');
    expect(staleWorker.removedListeners).toEqual([staleHandler]);

    const errorWorker = new FakeWorker();
    const errorService = createTaskService(errorWorker);
    const errorTask = errorService.dispatch({ requestId: 'r3', kind: 'mesh.generate', projectRevision: 3, payload: {} });
    errorWorker.emit({ type: 'error', data: { requestId: 'r3', code: 'FAILED', message: 'worker failed', retryable: false } });
    await expect(errorTask).rejects.toThrow('worker failed');
    expect(errorService.tasks.has('r3')).toBe(false);

    const cancelWorker = new FakeWorker();
    const cancelService = createTaskService(cancelWorker);
    const cancelledTask = cancelService.dispatch({ requestId: 'r4', kind: 'mesh.generate', projectRevision: 3, payload: {} });
    const cancelHandler = cancelService.tasks.get('r4').handler;
    cancelService.cancel('r4');
    await expect(cancelledTask).rejects.toMatchObject({ state: 'cancelled' });
    expect(cancelWorker.removedListeners).toEqual([cancelHandler]);
    expect(cancelWorker.messages.at(-1).message).toEqual({ type: 'cancel', requestId: 'r4' });
    expect(cancelService.tasks.has('r4')).toBe(false);
  });

  it('ignores responses belonging to another task on the shared worker', async () => {
    const worker = new FakeWorker();
    const service = createTaskService(worker);
    const first = service.dispatch({ requestId: 'r1', kind: 'mesh.generate', projectRevision: 1, payload: {} });
    const second = service.dispatch({ requestId: 'r2', kind: 'mesh.generate', projectRevision: 2, payload: {} });

    worker.emit({ type: 'result', data: { requestId: 'r2', projectRevision: 2, data: { mesh: 'second' } } });
    await expect(second).resolves.toMatchObject({ data: { mesh: 'second' } });
    expect(service.tasks.has('r1')).toBe(true);

    worker.emit({ type: 'result', data: { requestId: 'r1', projectRevision: 1, data: { mesh: 'first' } } });
    await expect(first).resolves.toMatchObject({ data: { mesh: 'first' } });
  });
});
