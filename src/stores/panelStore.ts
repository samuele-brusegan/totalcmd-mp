import { create } from 'zustand';
import type { PanelState, PanelTab, PanelSide, SortColumn, SortDirection, FileEntry } from '../types';
import { listLocalDir, getHomeDir } from '../services/localFs';

function createDefaultTab(path: string): PanelTab {
  return {
    id: crypto.randomUUID(),
    label: path.split('/').pop() || path,
    currentPath: path,
    files: [],
    selectedFiles: new Set(),
    cursorIndex: 0,
    sortColumn: 'name',
    sortDirection: 'asc',
    history: [path],
    historyIndex: 0,
    filter: '',
    loading: false,
    error: null,
  };
}

interface PanelStore {
  left: PanelState;
  right: PanelState;
  activeSide: PanelSide;

  setActiveSide: (side: PanelSide) => void;
  toggleActiveSide: () => void;

  loadDirectory: (side: PanelSide, path: string) => Promise<void>;
  refreshPanel: (side: PanelSide) => Promise<void>;
  navigateUp: (side: PanelSide) => void;
  navigateBack: (side: PanelSide) => void;
  navigateForward: (side: PanelSide) => void;

  setCursorIndex: (side: PanelSide, index: number) => void;
  toggleFileSelection: (side: PanelSide, filePath: string) => void;
  selectAll: (side: PanelSide) => void;
  deselectAll: (side: PanelSide) => void;
  invertSelection: (side: PanelSide) => void;

  setSortColumn: (side: PanelSide, column: SortColumn) => void;
  setFilter: (side: PanelSide, filter: string) => void;

  addTab: (side: PanelSide, path: string) => void;
  closeTab: (side: PanelSide, tabIndex: number) => void;
  setActiveTab: (side: PanelSide, tabIndex: number) => void;

  initializePanels: () => Promise<void>;

  getActiveTab: (side: PanelSide) => PanelTab;
  getSelectedPaths: (side: PanelSide) => string[];
  getOtherSide: () => PanelSide;
}

function sortFiles(files: FileEntry[], column: SortColumn, direction: SortDirection): FileEntry[] {
  const sorted = [...files].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) {
      return b.isDirectory ? 1 : -1;
    }

    let cmp = 0;
    switch (column) {
      case 'name':
        cmp = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        break;
      case 'size':
        cmp = a.size - b.size;
        break;
      case 'modified':
        cmp = (a.modified || '').localeCompare(b.modified || '');
        break;
      case 'extension':
        cmp = (a.extension || '').localeCompare(b.extension || '');
        break;
    }
    return direction === 'asc' ? cmp : -cmp;
  });
  return sorted;
}

function updateTab(state: PanelStore, side: PanelSide, updater: (tab: PanelTab) => Partial<PanelTab>): Partial<PanelStore> {
  const panel = state[side];
  const activeTab = panel.tabs[panel.activeTabIndex];
  if (!activeTab) return {};

  const updates = updater(activeTab);
  const newTab = { ...activeTab, ...updates };
  const newTabs = [...panel.tabs];
  newTabs[panel.activeTabIndex] = newTab;

  return {
    [side]: {
      ...panel,
      tabs: newTabs,
    },
  };
}

export const usePanelStore = create<PanelStore>((set, get) => ({
  left: {
    tabs: [createDefaultTab('/home')],
    activeTabIndex: 0,
  },
  right: {
    tabs: [createDefaultTab('/home')],
    activeTabIndex: 0,
  },
  activeSide: 'left',

  setActiveSide: (side) => set({ activeSide: side }),

  toggleActiveSide: () =>
    set((state) => ({
      activeSide: state.activeSide === 'left' ? 'right' : 'left',
    })),

  loadDirectory: async (side, path) => {
    set((state) => updateTab(state, side, () => ({ loading: true, error: null })));

    try {
      const files = await listLocalDir(path);
      set((state) => {
        const panel = state[side];
        const activeTab = panel.tabs[panel.activeTabIndex];
        if (!activeTab) return {};

        const newHistory = activeTab.history.slice(0, activeTab.historyIndex + 1);
        newHistory.push(path);

        return updateTab(state, side, () => ({
          currentPath: path,
          files: sortFiles(files, activeTab.sortColumn, activeTab.sortDirection),
          selectedFiles: new Set(),
          cursorIndex: 0,
          history: newHistory,
          historyIndex: newHistory.length - 1,
          label: path.split('/').filter(Boolean).pop() || path,
          loading: false,
          error: null,
        }));
      });
    } catch (e) {
      set((state) =>
        updateTab(state, side, () => ({
          loading: false,
          error: String(e),
        }))
      );
    }
  },

  refreshPanel: async (side) => {
    const tab = get().getActiveTab(side);
    if (tab) {
      const path = tab.currentPath;
      set((state) => updateTab(state, side, () => ({ loading: true, error: null })));
      try {
        const files = await listLocalDir(path);
        set((state) => {
          const activeTab = get().getActiveTab(side);
          return updateTab(state, side, () => ({
            files: sortFiles(files, activeTab.sortColumn, activeTab.sortDirection),
            loading: false,
          }));
        });
      } catch (e) {
        set((state) =>
          updateTab(state, side, () => ({
            loading: false,
            error: String(e),
          }))
        );
      }
    }
  },

  navigateUp: (side) => {
    const tab = get().getActiveTab(side);
    if (!tab) return;
    const parent = tab.currentPath.replace(/\/[^/]+\/?$/, '') || '/';
    if (parent !== tab.currentPath) {
      get().loadDirectory(side, parent);
    }
  },

  navigateBack: (side) => {
    const panel = get()[side];
    const tab = panel.tabs[panel.activeTabIndex];
    if (!tab || tab.historyIndex <= 0) return;
    const prevPath = tab.history[tab.historyIndex - 1];

    set((state) => updateTab(state, side, () => ({ historyIndex: tab.historyIndex - 1 })));
    get().loadDirectory(side, prevPath);
  },

  navigateForward: (side) => {
    const panel = get()[side];
    const tab = panel.tabs[panel.activeTabIndex];
    if (!tab || tab.historyIndex >= tab.history.length - 1) return;
    const nextPath = tab.history[tab.historyIndex + 1];

    set((state) => updateTab(state, side, () => ({ historyIndex: tab.historyIndex + 1 })));
    get().loadDirectory(side, nextPath);
  },

  setCursorIndex: (side, index) =>
    set((state) => updateTab(state, side, () => ({ cursorIndex: index }))),

  toggleFileSelection: (side, filePath) =>
    set((state) => {
      const tab = get().getActiveTab(side);
      if (!tab) return {};
      const newSelected = new Set(tab.selectedFiles);
      if (newSelected.has(filePath)) {
        newSelected.delete(filePath);
      } else {
        newSelected.add(filePath);
      }
      return updateTab(state, side, () => ({ selectedFiles: newSelected }));
    }),

  selectAll: (side) =>
    set((state) => {
      const tab = get().getActiveTab(side);
      if (!tab) return {};
      const newSelected = new Set(tab.files.map((f) => f.path));
      return updateTab(state, side, () => ({ selectedFiles: newSelected }));
    }),

  deselectAll: (side) =>
    set((state) => updateTab(state, side, () => ({ selectedFiles: new Set() }))),

  invertSelection: (side) =>
    set((state) => {
      const tab = get().getActiveTab(side);
      if (!tab) return {};
      const newSelected = new Set<string>();
      for (const f of tab.files) {
        if (!tab.selectedFiles.has(f.path)) {
          newSelected.add(f.path);
        }
      }
      return updateTab(state, side, () => ({ selectedFiles: newSelected }));
    }),

  setSortColumn: (side, column) =>
    set((state) => {
      const tab = get().getActiveTab(side);
      if (!tab) return {};
      const newDirection: SortDirection =
        tab.sortColumn === column && tab.sortDirection === 'asc' ? 'desc' : 'asc';
      return updateTab(state, side, () => ({
        sortColumn: column,
        sortDirection: newDirection,
        files: sortFiles(tab.files, column, newDirection),
      }));
    }),

  setFilter: (side, filter) =>
    set((state) => updateTab(state, side, () => ({ filter }))),

  addTab: (side, path) =>
    set((state) => {
      const panel = state[side];
      const newTab = createDefaultTab(path);
      return {
        [side]: {
          ...panel,
          tabs: [...panel.tabs, newTab],
          activeTabIndex: panel.tabs.length,
        },
      };
    }),

  closeTab: (side, tabIndex) =>
    set((state) => {
      const panel = state[side];
      if (panel.tabs.length <= 1) return {};
      const newTabs = panel.tabs.filter((_, i) => i !== tabIndex);
      const newActiveIndex = Math.min(panel.activeTabIndex, newTabs.length - 1);
      return {
        [side]: {
          ...panel,
          tabs: newTabs,
          activeTabIndex: newActiveIndex,
        },
      };
    }),

  setActiveTab: (side, tabIndex) =>
    set((state) => ({
      [side]: {
        ...state[side],
        activeTabIndex: tabIndex,
      },
    })),

  initializePanels: async () => {
    try {
      const home = await getHomeDir();
      set({
        left: { tabs: [createDefaultTab(home)], activeTabIndex: 0 },
        right: { tabs: [createDefaultTab(home)], activeTabIndex: 0 },
      });
      await Promise.all([
        get().loadDirectory('left', home),
        get().loadDirectory('right', home),
      ]);
    } catch {
      await Promise.all([
        get().loadDirectory('left', '/'),
        get().loadDirectory('right', '/'),
      ]);
    }
  },

  getActiveTab: (side) => {
    const panel = get()[side];
    return panel.tabs[panel.activeTabIndex];
  },

  getSelectedPaths: (side) => {
    const tab = get().getActiveTab(side);
    if (!tab) return [];
    if (tab.selectedFiles.size > 0) {
      return Array.from(tab.selectedFiles);
    }
    const cursorFile = tab.files[tab.cursorIndex];
    return cursorFile ? [cursorFile.path] : [];
  },

  getOtherSide: () => {
    return get().activeSide === 'left' ? 'right' : 'left';
  },
}));
