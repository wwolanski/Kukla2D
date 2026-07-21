import { describe, it, expect } from 'vitest';
import {
  createEditorCommand,
  createPointerDownEvent,
  createPointerMoveEvent,
  createPointerUpEvent,
  createPointerCancelEvent,
  createDropFilesEvent,
  createDragFilesEnterEvent,
  createDragFilesLeaveEvent,
  createKeyDownEvent,
  createGestureComputationCacheEntry,
  updateGestureCacheEntry,
} from '@/features/canvas/domain/workflowContracts.js';

describe('EditorCommand contract', () => {
  it('createEditorCommand returns object with type and payload', () => {
    const cmd = createEditorCommand('setSelection', { ids: ['a'] });
    expect(cmd).toEqual({ type: 'setSelection', payload: { ids: ['a'] } });
  });

  it('createEditorCommand defaults payload to empty object', () => {
    const cmd = createEditorCommand('clearSelection');
    expect(cmd.type).toBe('clearSelection');
    expect(cmd.payload).toEqual({});
  });

  it('createEditorCommand includes sessionId when provided', () => {
    const cmd = createEditorCommand('updateProject', { path: '/nodes' }, 42);
    expect(cmd.sessionId).toBe(42);
    expect(cmd.type).toBe('updateProject');
  });

  it('createEditorCommand omits sessionId when undefined', () => {
    const cmd = createEditorCommand('markDirty', {});
    expect('sessionId' in cmd).toBe(false);
  });

  it.each([
    'setSelection', 'clearSelection', 'setMarquee', 'beginBatch', 'endBatch',
    'updateProject', 'uploadPreview', 'uploadPixiResource', 'importFiles',
    'setHover', 'setActiveTool', 'setImportStatus', 'updatePixiPreview',
    'markDirty', 'autoKeyframe',
  ])('accepts command type: %s', (type) => {
    const cmd = createEditorCommand(type, {});
    expect(cmd.type).toBe(type);
  });
});

describe('EditorInteractionEvent contracts', () => {
  it('createPointerDownEvent has correct type and default modifiers', () => {
    const evt = createPointerDownEvent({ x: 1, y: 2 });
    expect(evt.type).toBe('pointerDown');
    expect(evt.pointer).toEqual({ x: 1, y: 2 });
    expect(evt.modifiers).toEqual({ altKey: false, ctrlKey: false, shiftKey: false, metaKey: false });
    expect(evt.button).toBe(0);
    expect(evt.target).toBeNull();
  });

  it('createPointerMoveEvent defaults pointer to null', () => {
    const evt = createPointerMoveEvent();
    expect(evt.type).toBe('pointerMove');
    expect(evt.pointer).toBeNull();
  });

  it('createPointerUpEvent accepts button parameter', () => {
    const evt = createPointerUpEvent(null, null, null, {}, 2);
    expect(evt.button).toBe(2);
  });

  it('createPointerCancelEvent returns empty event', () => {
    const evt = createPointerCancelEvent();
    expect(evt.type).toBe('pointerCancel');
    expect(evt.pointer).toBeNull();
  });

  it('createDropFilesEvent includes files', () => {
    const files = [new File([''], 'test.png')];
    const evt = createDropFilesEvent(files);
    expect(evt.type).toBe('dropFiles');
    expect(evt.files).toBe(files);
  });

  it('createDragFilesEnterEvent includes files', () => {
    const files = [new File([''], 'test.png')];
    const evt = createDragFilesEnterEvent(files);
    expect(evt.type).toBe('dragFilesEnter');
    expect(evt.files).toBe(files);
  });

  it('createDragFilesLeaveEvent returns leave event', () => {
    const evt = createDragFilesLeaveEvent();
    expect(evt.type).toBe('dragFilesLeave');
  });

  it('createKeyDownEvent includes key', () => {
    const evt = createKeyDownEvent('z', { ctrlKey: true });
    expect(evt.type).toBe('keyDown');
    expect(evt.key).toBe('z');
    expect(evt.modifiers.ctrlKey).toBe(true);
  });
});

describe('GestureComputationCacheEntry contract', () => {
  it('createGestureComputationCacheEntry requires sessionId', () => {
    const entry = createGestureComputationCacheEntry(7);
    expect(entry.sessionId).toBe(7);
    expect(entry.status).toBe('active');
    expect(entry.previewOverrides).toBeNull();
    expect(entry.startPositions).toBeNull();
    expect(entry.metadata).toEqual({});
  });

  it('updateGestureCacheEntry patches status', () => {
    const entry = createGestureComputationCacheEntry(1);
    const updated = updateGestureCacheEntry(entry, { status: 'committed' });
    expect(updated.status).toBe('committed');
    expect(updated.sessionId).toBe(1);
  });

  it('updateGestureCacheEntry patches previewOverrides', () => {
    const entry = createGestureComputationCacheEntry(2);
    const overrides = new Map([['node-1', { x: 10 }]]);
    const updated = updateGestureCacheEntry(entry, { previewOverrides: overrides });
    expect(updated.previewOverrides).toBe(overrides);
  });

  it('updateGestureCacheEntry patches startPositions', () => {
    const entry = createGestureComputationCacheEntry(3);
    const starts = new Map([['node-1', { x: 0, y: 0 }]]);
    const updated = updateGestureCacheEntry(entry, { startPositions: starts });
    expect(updated.startPositions).toBe(starts);
  });

  it('updateGestureCacheEntry merges metadata', () => {
    const entry = createGestureComputationCacheEntry(4);
    const withMeta = updateGestureCacheEntry(entry, { metadata: { mode: 'move' } });
    expect(withMeta.metadata).toEqual({ mode: 'move' });
    const merged = updateGestureCacheEntry(withMeta, { metadata: { axis: 'x' } });
    expect(merged.metadata).toEqual({ mode: 'move', axis: 'x' });
  });

  it('updateGestureCacheEntry does not mutate original', () => {
    const entry = createGestureComputationCacheEntry(5);
    const updated = updateGestureCacheEntry(entry, { status: 'cancelled' });
    expect(entry.status).toBe('active');
    expect(updated.status).toBe('cancelled');
  });
});
