
import { useUndoRedo } from '@/app/hooks/useUndoRedo';
import { RootErrorBoundary } from '@/app/layout/components/RootErrorBoundary.jsx';
import EditorLayout from '@/app/layout/EditorLayout';

import { Toaster } from '@/components/ui/toaster';


function App() {
  // Mount global undo/redo keyboard handler
  useUndoRedo();

  return (
    <RootErrorBoundary>
      <EditorLayout />
      <Toaster />
    </RootErrorBoundary>
  );
}

export default App;
