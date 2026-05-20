import { usePanelStore } from '../../stores/panelStore';
import { useUIStore } from '../../stores/uiStore';
import { copyItems, moveItems, deleteItems } from '../../services/localFs';

interface FnKey {
  key: string;
  label: string;
  action: () => void;
}

export function FunctionKeyBar() {
  const activeSide = usePanelStore((s) => s.activeSide);
  const getSelectedPaths = usePanelStore((s) => s.getSelectedPaths);
  const getOtherSide = usePanelStore((s) => s.getOtherSide);
  const getActiveTab = usePanelStore((s) => s.getActiveTab);
  const refreshPanel = usePanelStore((s) => s.refreshPanel);
  const openDialog = useUIStore((s) => s.openDialog);

  const handleCopy = async () => {
    const sources = getSelectedPaths(activeSide);
    const otherSide = getOtherSide();
    const destTab = getActiveTab(otherSide);
    if (sources.length === 0 || !destTab) return;

    try {
      await copyItems(sources, destTab.currentPath);
      await refreshPanel(otherSide);
    } catch (e) {
      console.error('Copy failed:', e);
    }
  };

  const handleMove = async () => {
    const sources = getSelectedPaths(activeSide);
    const otherSide = getOtherSide();
    const destTab = getActiveTab(otherSide);
    if (sources.length === 0 || !destTab) return;

    try {
      await moveItems(sources, destTab.currentPath);
      await Promise.all([refreshPanel(activeSide), refreshPanel(otherSide)]);
    } catch (e) {
      console.error('Move failed:', e);
    }
  };

  const handleDelete = async () => {
    const sources = getSelectedPaths(activeSide);
    if (sources.length === 0) return;

    const names = sources.map((p) => p.split('/').pop()).join(', ');
    openDialog('delete-confirm', {
      paths: sources,
      message: `Delete ${sources.length} item(s)?\n${names}`,
      onConfirm: async () => {
        try {
          await deleteItems(sources);
          await refreshPanel(activeSide);
        } catch (e) {
          console.error('Delete failed:', e);
        }
      },
    });
  };

  const fnKeys: FnKey[] = [
    { key: 'F3', label: 'View', action: () => {} },
    { key: 'F4', label: 'Edit', action: () => {} },
    { key: 'F5', label: 'Copy', action: handleCopy },
    { key: 'F6', label: 'Move', action: handleMove },
    { key: 'F7', label: 'MkDir', action: () => openDialog('mkdir') },
    { key: 'F8', label: 'Delete', action: handleDelete },
  ];

  return (
    <div className="flex items-center h-7 bg-[var(--color-fn-bar)] border-t border-[var(--color-border)]">
      {fnKeys.map((fn) => (
        <button
          key={fn.key}
          onClick={fn.action}
          className="flex-1 flex items-center justify-center gap-1 h-full hover:bg-[var(--color-bg-hover)] border-r border-[var(--color-border)] last:border-r-0 text-xs"
        >
          <span className="text-[var(--color-fn-key)] font-bold">{fn.key}</span>
          <span className="text-[var(--color-text-secondary)]">{fn.label}</span>
        </button>
      ))}
    </div>
  );
}
