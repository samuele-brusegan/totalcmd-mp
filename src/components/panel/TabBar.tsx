import { Plus, X } from 'lucide-react';
import { usePanelStore } from '../../stores/panelStore';
import type { PanelSide } from '../../types';

interface TabBarProps {
  side: PanelSide;
}

export function TabBar({ side }: TabBarProps) {
  const panel = usePanelStore((s) => s[side]);
  const setActiveTab = usePanelStore((s) => s.setActiveTab);
  const closeTab = usePanelStore((s) => s.closeTab);
  const addTab = usePanelStore((s) => s.addTab);
  const loadDirectory = usePanelStore((s) => s.loadDirectory);
  const currentTab = usePanelStore((s) => s[side].tabs[s[side].activeTabIndex]);

  const handleAddTab = async () => {
    const path = currentTab?.currentPath || '/';
    addTab(side, path);
    await loadDirectory(side, path);
  };

  return (
    <div className="flex items-center h-7 bg-[var(--color-bg-tertiary)] overflow-x-auto">
      {panel.tabs.map((tab, index) => (
        <div
          key={tab.id}
          onClick={() => setActiveTab(side, index)}
          className={`flex items-center gap-1 px-3 py-1 text-xs cursor-pointer border-r border-[var(--color-border)] min-w-0 max-w-[160px] ${
            index === panel.activeTabIndex
              ? 'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]'
              : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)]'
          }`}
        >
          <span className="truncate">{tab.label || 'New Tab'}</span>
          {panel.tabs.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTab(side, index);
              }}
              className="p-0.5 rounded hover:bg-[var(--color-bg-active)] flex-shrink-0"
            >
              <X size={10} />
            </button>
          )}
        </div>
      ))}
      <button
        onClick={handleAddTab}
        className="p-1 hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]"
        title="New Tab (Ctrl+T)"
      >
        <Plus size={12} />
      </button>
    </div>
  );
}
