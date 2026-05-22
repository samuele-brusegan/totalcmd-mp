import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsStore {
  showHidden: boolean;
  confirmDelete: boolean;
  confirmOverwrite: boolean;
  defaultSortColumn: 'name' | 'size' | 'modified' | 'extension';
  theme: 'dark' | 'light';
  fontSize: 'small' | 'medium' | 'large';
  showIcons: boolean;

  setShowHidden: (v: boolean) => void;
  setConfirmDelete: (v: boolean) => void;
  setConfirmOverwrite: (v: boolean) => void;
  setDefaultSortColumn: (v: 'name' | 'size' | 'modified' | 'extension') => void;
  setTheme: (v: 'dark' | 'light') => void;
  setFontSize: (v: 'small' | 'medium' | 'large') => void;
  setShowIcons: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      showHidden: false,
      confirmDelete: true,
      confirmOverwrite: true,
      defaultSortColumn: 'name',
      theme: 'dark',
      fontSize: 'small',
      showIcons: true,

      setShowHidden: (v) => set({ showHidden: v }),
      setConfirmDelete: (v) => set({ confirmDelete: v }),
      setConfirmOverwrite: (v) => set({ confirmOverwrite: v }),
      setDefaultSortColumn: (v) => set({ defaultSortColumn: v }),
      setTheme: (v) => set({ theme: v }),
      setFontSize: (v) => set({ fontSize: v }),
      setShowIcons: (v) => set({ showIcons: v }),
    }),
    { name: 'totalcmd-settings' }
  )
);
