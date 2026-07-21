/**
 * Animation lifecycle bridge.
 *
 * Decouples projectStore from animationStore to avoid circular imports.
 * projectStore calls notifyProjectChanged(); animationStore subscribes
 * via onProjectChanged() during initialization.
 *
 * No React, Zustand, DOM, WebGL, or Worker imports.
 */

type ProjectChangedListener = () => void;

let _listener: ProjectChangedListener | null = null;

export function onProjectChanged(listener: ProjectChangedListener | null): void {
  _listener = listener;
}

export function notifyProjectChanged(): void {
  if (_listener) _listener();
}
