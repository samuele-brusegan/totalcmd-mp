import { useEffect } from 'react';
import { usePanelStore } from '../stores/panelStore';
import { useUIStore } from '../stores/uiStore';
import { useGitStore } from '../stores/gitStore';
import { deleteItems } from '../services/localFs';
import { copyAcrossPanels, moveAcrossPanels } from '../services/transfer';

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
  const toggleFullscreen = useUIStore((s) => s.toggleFullscreen);
  const toggleGitPanel = useGitStore((s) => s.togglePanel);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (activeDialog) return;

      // Tab key - switch panels
      if (e.key === 'Tab' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        toggleActiveSide();
        return;
      }

      // F11 - toggle fullscreen
      if (e.key === 'F11') {
        e.preventDefault();
        toggleFullscreen();
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

      // Ctrl+F - connection manager (Total Commander-style)
      if (e.key === 'f' && e.ctrlKey) {
        e.preventDefault();
        openDialog('connection-manager');
        return;
      }

      // Ctrl+Shift+F - search files (Alt+F7 conflicts with WMs on Linux)
      if ((e.key === 'F' || e.key === 'f') && e.ctrlKey && e.shiftKey) {
        e.preventDefault();
        openDialog('search');
        return;
      }

      // Ctrl+Q - quick connect
      if (e.key === 'q' && e.ctrlKey) {
        e.preventDefault();
        openDialog('quick-connect');
        return;
      }

      // Ctrl+G - toggle git panel
      if (e.key === 'g' && e.ctrlKey) {
        e.preventDefault();
        toggleGitPanel();
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
                if (tab.isRemote && tab.connectionId) {
                  // Remote: download to temp first, then open viewer.
                  (async () => {
                    try {
                      const { prepareRemoteForEdit } = await import('../services/editor');
                      const session = await prepareRemoteForEdit(
                        tab.connectionId!,
                        file.path
                      );
                      openDialog('file-viewer', {
                        path: session.localPath,
                        displayName: file.name,
                      });
                    } catch (err) {
                      console.error('Remote view failed:', err);
                    }
                  })();
                } else {
                  openDialog('file-viewer', { path: file.path });
                }
              }
            }
          }
          break;

        case 'F4':
          e.preventDefault();
          {
            const tab = getActiveTab(activeSide);
            if (tab) {
              const file = tab.files[tab.cursorIndex];
              if (file && !file.isDirectory) {
                (async () => {
                  try {
                    const { openEditor } = await import('../services/editorLauncher');
                    await openEditor({
                      filePath: file.path,
                      displayName: file.name,
                      remote: tab.isRemote && tab.connectionId
                        ? { connectionId: tab.connectionId, remotePath: file.path }
                        : undefined,
                    });
                  } catch (err) {
                    console.error('Open editor failed:', err);
                  }
                })();
              }
            }
          }
          break;

        case 'F5':
          e.preventDefault();
          {
            const sources = getSelectedPaths(activeSide);
            const sourceTab = getActiveTab(activeSide);
            const otherSide = getOtherSide();
            const destTab = getActiveTab(otherSide);
            if (sources.length > 0 && sourceTab && destTab) {
              try {
                await copyAcrossPanels({
                  sourceTab,
                  sourcePaths: sources,
                  destTab,
                  destDir: destTab.currentPath,
                });
                await refreshPanel(otherSide);
              } catch (err) {
                console.error('Copy failed:', err);
                alert(`Copy failed: ${err}`);
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
            const sourceTab = getActiveTab(activeSide);
            const otherSide = getOtherSide();
            const destTab = getActiveTab(otherSide);
            if (sources.length > 0 && sourceTab && destTab) {
              try {
                await moveAcrossPanels({
                  sourceTab,
                  sourcePaths: sources,
                  destTab,
                  destDir: destTab.currentPath,
                });
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
    toggleFullscreen,
    toggleGitPanel,
  ]);
}
