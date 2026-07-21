/**
 * Installs imperative canvas handlers on refs supplied by the app shell.
 *
 * Each ref is cleared only while it still owns the installed handler.
 */
import { useEffect } from 'react';

import type { RefObject } from 'react';

type ImperativeHandler = (...args: never[]) => unknown;
type OptionalImperativeRef = RefObject<unknown> | undefined;

interface CanvasImperativeRefs {
  remeshRef?: OptionalImperativeRef;
  deleteMeshRef?: OptionalImperativeRef;
  saveRef?: OptionalImperativeRef;
  loadRef?: OptionalImperativeRef;
  resetRef?: OptionalImperativeRef;
  exportCaptureRef?: OptionalImperativeRef;
  thumbCaptureRef?: OptionalImperativeRef;
}

interface CanvasImperativeHandlers {
  remeshPart: ImperativeHandler;
  deleteMeshForPart: ImperativeHandler;
  handleSave: ImperativeHandler;
  handleLoadProject: ImperativeHandler;
  handleReset: ImperativeHandler;
  captureExportFrame: ImperativeHandler;
  captureStaging: ImperativeHandler;
}

function useImperativeRef(ref: OptionalImperativeRef, handler: ImperativeHandler): void {
  useEffect(() => {
    if (!ref) return undefined;
    ref.current = handler;
    return () => {
      // Do not clear a handler installed by a newer effect.
      if (ref.current === handler) ref.current = null;
    };
  }, [ref, handler]);
}

export function useCanvasImperativeApi(refs: CanvasImperativeRefs, handlers: CanvasImperativeHandlers): void {
  useImperativeRef(refs.remeshRef, handlers.remeshPart);
  useImperativeRef(refs.deleteMeshRef, handlers.deleteMeshForPart);
  useImperativeRef(refs.saveRef, handlers.handleSave);
  useImperativeRef(refs.loadRef, handlers.handleLoadProject);
  useImperativeRef(refs.resetRef, handlers.handleReset);
  useImperativeRef(refs.exportCaptureRef, handlers.captureExportFrame);
  useImperativeRef(refs.thumbCaptureRef, handlers.captureStaging);
}
