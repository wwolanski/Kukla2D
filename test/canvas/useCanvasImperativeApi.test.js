// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import React, { useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { useCanvasImperativeApi } from '@/features/canvas/application/useCanvasImperativeApi.js';

// eslint-disable-next-line react/prop-types
function Harness({ handlers }) {
  const refs = {
    remeshRef: useRef(null),
    deleteMeshRef: useRef(null),
    saveRef: useRef(null),
    loadRef: useRef(null),
    resetRef: useRef(null),
    exportCaptureRef: useRef(null),
    thumbCaptureRef: useRef(null),
  };
  useCanvasImperativeApi(refs, handlers);
  // expose for tests
  Harness.refs = refs;
  return null;
}

describe('useCanvasImperativeApi', () => {
  let container;
  let root;
  afterEach(() => {
    if (root) {
      act(() => root.unmount());
      root = null;
    }
    document.body.innerHTML = '';
  });

  function mount(handlers) {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(React.createElement(Harness, { handlers }));
    });
    return Harness.refs;
  }

  it('assigns all handlers to refs', () => {
    const handlers = {
      remeshPart: () => 'remesh',
      deleteMeshForPart: () => 'delete',
      handleSave: () => 'save',
      handleLoadProject: () => 'load',
      handleReset: () => 'reset',
      captureExportFrame: () => 'export',
      captureStaging: () => 'thumb',
    };
    const refs = mount(handlers);
    expect(refs.remeshRef.current()).toBe('remesh');
    expect(refs.deleteMeshRef.current()).toBe('delete');
    expect(refs.saveRef.current()).toBe('save');
    expect(refs.loadRef.current()).toBe('load');
    expect(refs.resetRef.current()).toBe('reset');
    expect(refs.exportCaptureRef.current()).toBe('export');
    expect(refs.thumbCaptureRef.current()).toBe('thumb');
  });

  it('clears refs on unmount', () => {
    const handlers = {
      remeshPart: () => 1,
      deleteMeshForPart: () => 2,
      handleSave: () => 3,
      handleLoadProject: () => 4,
      handleReset: () => 5,
      captureExportFrame: () => 6,
      captureStaging: () => 7,
    };
    const refs = mount(handlers);
    expect(refs.remeshRef.current).toBeTruthy();
    act(() => root.unmount());
    root = null;
    expect(refs.remeshRef.current).toBeNull();
    expect(refs.saveRef.current).toBeNull();
  });
});
