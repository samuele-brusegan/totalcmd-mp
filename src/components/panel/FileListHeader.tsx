import { ArrowUp, ArrowDown } from 'lucide-react';
import { usePanelStore } from '../../stores/panelStore';
import type { PanelSide, SortColumn } from '../../types';

interface FileListHeaderProps {
  side: PanelSide;
}

const columns: { key: SortColumn; label: string; width: string }[] = [
  { key: 'name', label: 'Name', width: 'flex-1 min-w-0' },
  { key: 'extension', label: 'Ext', width: 'w-16' },
  { key: 'size', label: 'Size', width: 'w-24 text-right' },
  { key: 'modified', label: 'Modified', width: 'w-36' },
];

export function FileListHeader({ side }: FileListHeaderProps) {
  const getActiveTab = usePanelStore((s) => s.getActiveTab);
  const setSortColumn = usePanelStore((s) => s.setSortColumn);
  const tab = getActiveTab(side);

  if (!tab) return null;

  return (
    <div className="flex items-center h-6 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] px-2 text-xs font-semibold text-[var(--color-text-muted)] select-none">
      <div className="w-5 flex-shrink-0" />
      {columns.map((col) => (
        <button
          key={col.key}
          onClick={() => setSortColumn(side, col.key)}
          className={`${col.width} flex items-center gap-1 px-1 hover:text-[var(--color-text-primary)] cursor-pointer`}
        >
          <span className="truncate">{col.label}</span>
          {tab.sortColumn === col.key && (
            tab.sortDirection === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />
          )}
        </button>
      ))}
      <div className="w-20 px-1">Perms</div>
    </div>
  );
}
