import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type EditorMode = 'internal' | 'external';

interface SettingsStore {
  showHidden: boolean;
  confirmDelete: boolean;
  confirmOverwrite: boolean;
  defaultSortColumn: 'name' | 'size' | 'modified' | 'extension';
  theme: 'dark' | 'light';
  fontSize: 'small' | 'medium' | 'large';
  showIcons: boolean;
  editorMode: EditorMode;
  externalEditorCommand: string;
  ftpParallelTransfers: number;

  setShowHidden: (v: boolean) => void;
  setConfirmDelete: (v: boolean) => void;
  setConfirmOverwrite: (v: boolean) => void;
  setDefaultSortColumn: (v: 'name' | 'size' | 'modified' | 'extension') => void;
  setTheme: (v: 'dark' | 'light') => void;
  setFontSize: (v: 'small' | 'medium' | 'large') => void;
  setShowIcons: (v: boolean) => void;
  setEditorMode: (v: EditorMode) => void;
  setExternalEditorCommand: (v: string) => void;
  setFtpParallelTransfers: (v: number) => void;
}

function defaultExternalEditor(): string {
  if (typeof navigator === 'undefined') return 'gedit';
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return 'notepad';
  if (/Mac OS X|Macintosh/i.test(ua)) return 'open -e';
  return 'gedit';
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
      editorMode: 'internal',
      externalEditorCommand: defaultExternalEditor(),
      ftpParallelTransfers: 4,

      setShowHidden: (v) => set({ showHidden: v }),
      setConfirmDelete: (v) => set({ confirmDelete: v }),
      setConfirmOverwrite: (v) => set({ confirmOverwrite: v }),
      setDefaultSortColumn: (v) => set({ defaultSortColumn: v }),
      setTheme: (v) => set({ theme: v }),
      setFontSize: (v) => set({ fontSize: v }),
      setShowIcons: (v) => set({ showIcons: v }),
      setEditorMode: (v) => set({ editorMode: v }),
      setExternalEditorCommand: (v) => set({ externalEditorCommand: v }),
      setFtpParallelTransfers: (v) =>
        set({ ftpParallelTransfers: Math.min(16, Math.max(1, Math.round(v))) }),
    }),
    { name: 'totalcmd-settings' }
  )
);
