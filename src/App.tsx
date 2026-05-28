import { useEffect } from 'react';
import { Panel as ResizablePanel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { TitleBar } from './components/layout/TitleBar';
import { MenuBar } from './components/layout/MenuBar';
import { Toolbar } from './components/layout/Toolbar';
import { FunctionKeyBar } from './components/layout/FunctionKeyBar';
import { StatusBar } from './components/layout/StatusBar';
import { Panel } from './components/panel/Panel';
import { MkDirDialog } from './components/dialogs/MkDirDialog';
import { RenameDialog } from './components/dialogs/RenameDialog';
import { DeleteConfirmDialog } from './components/dialogs/DeleteConfirmDialog';
import { QuickFilterDialog } from './components/dialogs/QuickFilterDialog';
import { SearchDialog } from './components/dialogs/SearchDialog';
import { ConnectionManagerDialog } from './components/dialogs/ConnectionManagerDialog';
import { DriveSelector } from './components/dialogs/DriveSelector';
import { QuickConnectDialog } from './components/dialogs/QuickConnectDialog';
import { FileViewerDialog } from './components/dialogs/FileViewerDialog';
import { ChmodDialog } from './components/dialogs/ChmodDialog';
import { SettingsDialog } from './components/dialogs/SettingsDialog';
import { HelpDialog } from './components/dialogs/HelpDialog';
import { MultiRenameDialog } from './components/dialogs/MultiRenameDialog';
import { DirCompareDialog } from './components/dialogs/DirCompareDialog';
import { TransferProgress } from './components/transfer/TransferProgress';
import { GitPanel } from './components/git/GitPanel';
import { usePanelStore } from './stores/panelStore';
import { useUIStore } from './stores/uiStore';
import { useGitStore } from './stores/gitStore';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

function DialogManager() {
  const activeDialog = useUIStore((s) => s.activeDialog);

  switch (activeDialog) {
    case 'mkdir':
      return <MkDirDialog />;
    case 'rename':
      return <RenameDialog />;
    case 'delete-confirm':
      return <DeleteConfirmDialog />;
    case 'quick-filter':
      return <QuickFilterDialog />;
    case 'search':
      return <SearchDialog />;
    case 'connection-manager':
      return <ConnectionManagerDialog />;
    case 'drive-selector':
      return <DriveSelector />;
    case 'quick-connect':
      return <QuickConnectDialog />;
    case 'file-viewer':
      return <FileViewerDialog />;
    case 'chmod':
      return <ChmodDialog />;
    case 'settings':
      return <SettingsDialog />;
    case 'help':
      return <HelpDialog />;
    case 'multi-rename':
      return <MultiRenameDialog />;
    case 'dir-compare':
      return <DirCompareDialog />;
    default:
      return null;
  }
}

export default function App() {
  const initializePanels = usePanelStore((s) => s.initializePanels);
  const activeSide = usePanelStore((s) => s.activeSide);
  const leftTab = usePanelStore((s) => s.left.tabs[s.left.activeTabIndex]);
  const rightTab = usePanelStore((s) => s.right.tabs[s.right.activeTabIndex]);
  const fullscreen = useUIStore((s) => s.fullscreen);
  const gitPanelOpen = useGitStore((s) => s.panelOpen);
  const setGitCwd = useGitStore((s) => s.setCwd);

  useKeyboardShortcuts();

  useEffect(() => {
    initializePanels();
  }, [initializePanels]);

  // Sync git store with active panel cwd (only for local tabs)
  useEffect(() => {
    const tab = activeSide === 'left' ? leftTab : rightTab;
    if (tab && !tab.isRemote) {
      setGitCwd(tab.currentPath);
    } else {
      setGitCwd(null);
    }
  }, [activeSide, leftTab, rightTab, setGitCwd]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      {!fullscreen && <TitleBar />}
      <MenuBar />
      <Toolbar />

      <div className="flex-1 min-h-0">
        <PanelGroup orientation="vertical" className="h-full">
          <ResizablePanel defaultSize={gitPanelOpen ? 65 : 100} minSize={20}>
            <PanelGroup orientation="horizontal" className="h-full">
              <ResizablePanel defaultSize={50} minSize={20}>
                <Panel side="left" />
              </ResizablePanel>

              <PanelResizeHandle className="w-1 bg-[var(--color-border)] hover:bg-[var(--color-accent)] transition-colors cursor-col-resize" />

              <ResizablePanel defaultSize={50} minSize={20}>
                <Panel side="right" />
              </ResizablePanel>
            </PanelGroup>
          </ResizablePanel>

          {gitPanelOpen && (
            <>
              <PanelResizeHandle className="h-1 bg-[var(--color-border)] hover:bg-[var(--color-accent)] transition-colors cursor-row-resize" />
              <ResizablePanel defaultSize={35} minSize={15}>
                <GitPanel />
              </ResizablePanel>
            </>
          )}
        </PanelGroup>
      </div>

      <TransferProgress />
      <StatusBar />
      <FunctionKeyBar />

      <DialogManager />
    </div>
  );
}
