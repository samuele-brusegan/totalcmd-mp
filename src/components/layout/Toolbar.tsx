import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Home,
  RefreshCw,
} from 'lucide-react';
import { usePanelStore } from '../../stores/panelStore';
import { getHomeDir } from '../../services/localFs';

export function Toolbar() {
  const activeSide = usePanelStore((s) => s.activeSide);
  const navigateUp = usePanelStore((s) => s.navigateUp);
  const navigateBack = usePanelStore((s) => s.navigateBack);
  const navigateForward = usePanelStore((s) => s.navigateForward);
  const refreshPanel = usePanelStore((s) => s.refreshPanel);
  const loadDirectory = usePanelStore((s) => s.loadDirectory);
  const getActiveTab = usePanelStore((s) => s.getActiveTab);

  const tab = getActiveTab(activeSide);
  const canGoBack = tab && tab.historyIndex > 0;
  const canGoForward = tab && tab.historyIndex < tab.history.length - 1;

  const buttons = [
    {
      icon: ArrowLeft,
      label: 'Back',
      action: () => navigateBack(activeSide),
      disabled: !canGoBack,
    },
    {
      icon: ArrowRight,
      label: 'Forward',
      action: () => navigateForward(activeSide),
      disabled: !canGoForward,
    },
    {
      icon: ArrowUp,
      label: 'Up',
      action: () => navigateUp(activeSide),
      disabled: tab?.currentPath === '/',
    },
    {
      icon: Home,
      label: 'Home',
      action: async () => {
        const home = await getHomeDir();
        loadDirectory(activeSide, home);
      },
      disabled: false,
    },
    {
      icon: RefreshCw,
      label: 'Refresh',
      action: () => refreshPanel(activeSide),
      disabled: false,
    },
  ];

  return (
    <div className="flex items-center h-8 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] px-2 gap-1">
      {buttons.map((btn) => (
        <button
          key={btn.label}
          onClick={btn.action}
          disabled={btn.disabled}
          title={btn.label}
          className="p-1.5 rounded hover:bg-[var(--color-bg-hover)] disabled:opacity-30 disabled:cursor-not-allowed text-[var(--color-text-secondary)]"
        >
          <btn.icon size={14} />
        </button>
      ))}
    </div>
  );
}
