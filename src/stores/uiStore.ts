import { create } from 'zustand';

type DialogType = 'mkdir' | 'rename' | 'delete-confirm' | 'quick-filter' | null;
type Theme = 'dark' | 'light';

interface UIStore {
  theme: Theme;
  activeDialog: DialogType;
  dialogData: Record<string, unknown>;

  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  openDialog: (dialog: DialogType, data?: Record<string, unknown>) => void;
  closeDialog: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  theme: 'dark',
  activeDialog: null,
  dialogData: {},

  setTheme: (theme) => set({ theme }),
  toggleTheme: () =>
    set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
  openDialog: (dialog, data = {}) =>
    set({ activeDialog: dialog, dialogData: data }),
  closeDialog: () => set({ activeDialog: null, dialogData: {} }),
}));
