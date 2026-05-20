import { useEffect } from 'react';
import { Panel as ResizablePanel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { MenuBar } from './components/layout/MenuBar';
import { Toolbar } from './components/layout/Toolbar';
import { FunctionKeyBar } from './components/layout/FunctionKeyBar';
import { StatusBar } from './components/layout/StatusBar';
import { Panel } from './components/panel/Panel';
import { MkDirDialog } from './components/dialogs/MkDirDialog';
import { RenameDialog } from './components/dialogs/RenameDialog';
import { DeleteConfirmDialog } from './components/dialogs/DeleteConfirmDialog';
import { usePanelStore } from './stores/panelStore';
import { useUIStore } from './stores/uiStore';
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
    default:
      return null;
  }
}

export default function App() {
  const initializePanels = usePanelStore((s) => s.initializePanels);

  useKeyboardShortcuts();

  useEffect(() => {
    initializePanels();
  }, [initializePanels]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      <MenuBar />
      <Toolbar />

      <div className="flex-1 min-h-0">
        <PanelGroup orientation="horizontal" className="h-full">
          <ResizablePanel defaultSize={50} minSize={20}>
            <Panel side="left" />
          </ResizablePanel>

          <PanelResizeHandle className="w-1 bg-[var(--color-border)] hover:bg-[var(--color-accent)] transition-colors cursor-col-resize" />

          <ResizablePanel defaultSize={50} minSize={20}>
            <Panel side="right" />
          </ResizablePanel>
        </PanelGroup>
      </div>

      <StatusBar />
      <FunctionKeyBar />

      <DialogManager />
    </div>
  );
}
