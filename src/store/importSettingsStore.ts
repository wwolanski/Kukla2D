import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface ImportSettingsState {
  autoAddToCanvas: boolean;
  setAutoAddToCanvas: (enabled: boolean) => void;
}

export const useImportSettingsStore = create<ImportSettingsState>()(persist(
  set => ({
    autoAddToCanvas: true,
    setAutoAddToCanvas: enabled => set({ autoAddToCanvas: enabled }),
  }),
  {
    name: 'kukla2d-import-settings',
    storage: createJSONStorage(() => localStorage),
    partialize: state => ({ autoAddToCanvas: state.autoAddToCanvas }),
    version: 1,
  },
));
