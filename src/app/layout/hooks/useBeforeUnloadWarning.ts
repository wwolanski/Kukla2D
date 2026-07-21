import { useEffect } from 'react';

export function useBeforeUnloadWarning(hasUnsavedChanges: boolean): void {
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        event.preventDefault();
        event.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    if (hasUnsavedChanges) {
      window.onbeforeunload = () => '';
    } else {
      window.onbeforeunload = null;
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.onbeforeunload = null;
    };
  }, [hasUnsavedChanges]);
}
