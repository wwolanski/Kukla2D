import { act } from 'react';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

export function renderHook(useHook) {
  let current;
  const container = document.createElement('div');
  const root = createRoot(container);

  function HookHarness() {
    current = useHook();
    return null;
  }

  act(() => {
    root.render(<HookHarness />);
  });

  return {
    result: {
      get current() {
        return current;
      },
    },
    unmount() {
      act(() => root.unmount());
    },
  };
}

export { act };
