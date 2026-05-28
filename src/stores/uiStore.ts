import { create } from 'zustand';

type DialogType = 'mkdir' | 'rename' | 'delete-confirm' | 'quick-filter' | 'search' | 'connection-manager' | 'drive-selector' | 'quick-connect' | 'file-viewer' | 'chmod' | 'settings' | 'help' | 'multi-rename' | 'dir-compare' | null;
type Theme = 'dark' | 'light';

interface UIStore {
  theme: Theme;
  activeDialog: DialogType;
  dialogData: Record<string, unknown>;
  fullscreen: boolean;

  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  openDialog: (dialog: DialogType, data?: Record<string, unknown>) => void;
  closeDialog: () => void;
  toggleFullscreen: () => Promise<void>;
}

export const useUIStore = create<UIStore>((set, get) => ({
  theme: 'dark',
  activeDialog: null,
  dialogData: {},
  fullscreen: false,

  setTheme: (theme) => set({ theme }),
  toggleTheme: () =>
    set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
  openDialog: (dialog, data = {}) =>
    set({ activeDialog: dialog, dialogData: data }),
  closeDialog: () => set({ activeDialog: null, dialogData: {} }),
  toggleFullscreen: async () => {
    const next = !get().fullscreen;
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().setFullscreen(next);
    } catch {
      // Non-Tauri / fallback: ignore
    }
    set({ fullscreen: next });
  },
}));
