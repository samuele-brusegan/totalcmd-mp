import { useEffect } from 'react';
import { usePanelStore } from '../stores/panelStore';
import { useUIStore } from '../stores/uiStore';
import { copyItems, moveItems, deleteItems } from '../services/localFs';

export function useKeyboardShortcuts() {
  const toggleActiveSide = usePanelStore((s) => s.toggleActiveSide);
  const activeSide = usePanelStore((s) => s.activeSide);
  const getSelectedPaths = usePanelStore((s) => s.getSelectedPaths);
  const getOtherSide = usePanelStore((s) => s.getOtherSide);
  const getActiveTab = usePanelStore((s) => s.getActiveTab);
  const refreshPanel = usePanelStore((s) => s.refreshPanel);
  const selectAll = usePanelStore((s) => s.selectAll);
  const invertSelection = usePanelStore((s) => s.invertSelection);
  const setFilter = usePanelStore((s) => s.setFilter);
  const addTab = usePanelStore((s) => s.addTab);
  const closeTab = usePanelStore((s) => s.closeTab);
  const loadDirectory = usePanelStore((s) => s.loadDirectory);
  const openDialog = useUIStore((s) => s.openDialog);
  const activeDialog = useUIStore((s) => s.activeDialog);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (activeDialog) return;

      // Tab key - switch panels
      if (e.key === 'Tab' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        toggleActiveSide();
        return;
      }

      // Ctrl+A - select all
      if (e.key === 'a' && e.ctrlKey) {
        e.preventDefault();
        selectAll(activeSide);
        return;
      }

      // Ctrl+T - new tab
      if (e.key === 't' && e.ctrlKey) {
        e.preventDefault();
        const tab = getActiveTab(activeSide);
        addTab(activeSide, tab?.currentPath || '/');
        if (tab) loadDirectory(activeSide, tab.currentPath);
        return;
      }

      // Ctrl+W - close tab
      if (e.key === 'w' && e.ctrlKey) {
        e.preventDefault();
        const panel = usePanelStore.getState()[activeSide];
        closeTab(activeSide, panel.activeTabIndex);
        return;
      }

      // Ctrl+S - quick filter
      if (e.key === 's' && e.ctrlKey) {
        e.preventDefault();
        openDialog('quick-filter');
        return;
      }

      // Ctrl+F - search files
      if (e.key === 'f' && e.ctrlKey) {
        e.preventDefault();
        openDialog('search');
        return;
      }

      // Ctrl+P - connection manager
      if (e.key === 'p' && e.ctrlKey) {
        e.preventDefault();
        openDialog('connection-manager');
        return;
      }

      // Ctrl+Q - quick connect
      if (e.key === 'q' && e.ctrlKey) {
        e.preventDefault();
        openDialog('quick-connect');
        return;
      }

      // Ctrl+M - multi rename
      if (e.key === 'm' && e.ctrlKey) {
        e.preventDefault();
        const tab = getActiveTab(activeSide);
        if (tab && tab.selectedFiles.size > 0) {
          openDialog('multi-rename', { paths: Array.from(tab.selectedFiles) });
        }
        return;
      }

      // Ctrl+L - focus path bar (handled by PathBar)
      // Num * - invert selection
      if (e.key === '*') {
        e.preventDefault();
        invertSelection(activeSide);
        return;
      }

      // Alt+F1 / Alt+F2 - drive selector
      if (e.key === 'F1' && e.altKey) {
        e.preventDefault();
        openDialog('drive-selector', { side: 'left' });
        return;
      }
      if (e.key === 'F2' && e.altKey) {
        e.preventDefault();
        openDialog('drive-selector', { side: 'right' });
        return;
      }

      // Function keys
      switch (e.key) {
        case 'F1':
          e.preventDefault();
          openDialog('help');
          break;

        case 'F2':
          e.preventDefault();
          refreshPanel(activeSide);
          break;

        case 'F3':
          e.preventDefault();
          {
            const tab = getActiveTab(activeSide);
            if (tab) {
              const file = tab.files[tab.cursorIndex];
              if (file && !file.isDirectory) {
                openDialog('file-viewer', { path: file.path });
              }
            }
          }
          break;

        case 'F5':
          e.preventDefault();
          {
            const sources = getSelectedPaths(activeSide);
            const otherSide = getOtherSide();
            const destTab = getActiveTab(otherSide);
            if (sources.length > 0 && destTab) {
              try {
                await copyItems(sources, destTab.currentPath);
                await refreshPanel(otherSide);
              } catch (err) {
                console.error('Copy failed:', err);
              }
            }
          }
          break;

        case 'F6':
          e.preventDefault();
          if (e.shiftKey) {
            const tab = getActiveTab(activeSide);
            if (tab && tab.files[tab.cursorIndex]) {
              openDialog('rename', { path: tab.files[tab.cursorIndex].path });
            }
          } else {
            const sources = getSelectedPaths(activeSide);
            const otherSide = getOtherSide();
            const destTab = getActiveTab(otherSide);
            if (sources.length > 0 && destTab) {
              try {
                await moveItems(sources, destTab.currentPath);
                await Promise.all([refreshPanel(activeSide), refreshPanel(otherSide)]);
              } catch (err) {
                console.error('Move failed:', err);
              }
            }
          }
          break;

        case 'F7':
          e.preventDefault();
          openDialog('mkdir');
          break;

        case 'F8':
        case 'Delete':
          e.preventDefault();
          {
            const sources = getSelectedPaths(activeSide);
            if (sources.length > 0) {
              const names = sources.map((p) => p.split('/').pop()).join(', ');
              openDialog('delete-confirm', {
                paths: sources,
                message: `Delete ${sources.length} item(s)?\n${names}`,
                onConfirm: async () => {
                  await deleteItems(sources);
                  await refreshPanel(activeSide);
                },
              });
            }
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeDialog,
    activeSide,
    toggleActiveSide,
    selectAll,
    invertSelection,
    setFilter,
    addTab,
    closeTab,
    loadDirectory,
    getActiveTab,
    getSelectedPaths,
    getOtherSide,
    refreshPanel,
    openDialog,
  ]);
}
