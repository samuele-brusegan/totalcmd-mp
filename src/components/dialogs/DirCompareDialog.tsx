import { useState, useMemo } from 'react';
import { X, ArrowRight, Equal, AlertTriangle, FilePlus } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { usePanelStore } from '../../stores/panelStore';
import type { FileEntry } from '../../types';

type DiffStatus = 'same' | 'different' | 'left-only' | 'right-only';

interface DiffEntry {
  name: string;
  status: DiffStatus;
  leftFile?: FileEntry;
  rightFile?: FileEntry;
}

function compareDirectories(leftFiles: FileEntry[], rightFiles: FileEntry[]): DiffEntry[] {
  const leftMap = new Map<string, FileEntry>();
  const rightMap = new Map<string, FileEntry>();
  for (const f of leftFiles) leftMap.set(f.name, f);
  for (const f of rightFiles) rightMap.set(f.name, f);

  const allNames = new Set([...leftMap.keys(), ...rightMap.keys()]);
  const entries: DiffEntry[] = [];

  for (const name of allNames) {
    const left = leftMap.get(name);
    const right = rightMap.get(name);

    if (left && right) {
      const sameSize = left.size === right.size;
      const sameMod = left.modified === right.modified;
      entries.push({
        name,
        status: sameSize && sameMod ? 'same' : 'different',
        leftFile: left,
        rightFile: right,
      });
    } else if (left) {
      entries.push({ name, status: 'left-only', leftFile: left });
    } else if (right) {
      entries.push({ name, status: 'right-only', rightFile: right });
    }
  }

  entries.sort((a, b) => {
    const order: Record<DiffStatus, number> = { 'left-only': 0, 'right-only': 1, 'different': 2, 'same': 3 };
    return order[a.status] - order[b.status] || a.name.localeCompare(b.name);
  });

  return entries;
}

export function DirCompareDialog() {
  const closeDialog = useUIStore((s) => s.closeDialog);
  const getActiveTab = usePanelStore((s) => s.getActiveTab);
  const [showSame, setShowSame] = useState(false);

  const leftTab = getActiveTab('left');
  const rightTab = getActiveTab('right');

  const diff = useMemo(() => {
    if (leftTab && rightTab) {
      return compareDirectories(leftTab.files, rightTab.files);
    }
    return [];
  }, [leftTab, rightTab]);

  const filtered = showSame ? diff : diff.filter((d) => d.status !== 'same');

  const stats = {
    same: diff.filter((d) => d.status === 'same').length,
    different: diff.filter((d) => d.status === 'different').length,
    leftOnly: diff.filter((d) => d.status === 'left-only').length,
    rightOnly: diff.filter((d) => d.status === 'right-only').length,
  };

  const statusIcon = (status: DiffStatus) => {
    switch (status) {
      case 'same': return <Equal size={10} className="text-green-400" />;
      case 'different': return <AlertTriangle size={10} className="text-yellow-400" />;
      case 'left-only': return <ArrowRight size={10} className="text-cyan-400" />;
      case 'right-only': return <FilePlus size={10} className="text-purple-400" />;
    }
  };

  const statusColor = (status: DiffStatus) => {
    switch (status) {
      case 'same': return 'text-green-400';
      case 'different': return 'text-yellow-400';
      case 'left-only': return 'text-cyan-400';
      case 'right-only': return 'text-purple-400';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={closeDialog}>
      <div
        className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-xl w-[650px] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-3 border-b border-[var(--color-border)]">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Directory Compare</h3>
          <button onClick={closeDialog} className="p-1 hover:bg-[var(--color-bg-hover)] rounded">
            <X size={14} />
          </button>
        </div>

        <div className="px-4 py-2 border-b border-[var(--color-border)] flex items-center justify-between text-[10px]">
          <div className="flex gap-3 text-[var(--color-text-muted)]">
            <span className="text-green-400">{stats.same} same</span>
            <span className="text-yellow-400">{stats.different} different</span>
            <span className="text-cyan-400">{stats.leftOnly} left only</span>
            <span className="text-purple-400">{stats.rightOnly} right only</span>
          </div>
          <label className="flex items-center gap-1 text-[var(--color-text-muted)]">
            <input type="checkbox" checked={showSame} onChange={(e) => setShowSame(e.target.checked)} className="w-3 h-3" />
            Show identical
          </label>
        </div>

        <div className="px-4 py-1 grid grid-cols-2 gap-2 text-[10px] text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
          <span className="truncate">Left: {leftTab?.currentPath || '—'}</span>
          <span className="truncate">Right: {rightTab?.currentPath || '—'}</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.map((entry, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-4 py-1 hover:bg-[var(--color-bg-hover)] text-xs border-b border-[var(--color-border)]/20"
            >
              <span className="w-4 flex-shrink-0">{statusIcon(entry.status)}</span>
              <span className={`flex-1 truncate ${statusColor(entry.status)}`}>{entry.name}</span>
              <span className="w-16 text-right text-[var(--color-text-muted)]">
                {entry.leftFile && !entry.leftFile.isDirectory ? formatSize(entry.leftFile.size) : ''}
              </span>
              <span className="w-16 text-right text-[var(--color-text-muted)]">
                {entry.rightFile && !entry.rightFile.isDirectory ? formatSize(entry.rightFile.size) : ''}
              </span>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="flex items-center justify-center h-20 text-xs text-[var(--color-text-muted)]">
              {diff.length === 0 ? 'No files to compare' : 'All files are identical'}
            </div>
          )}
        </div>

        <div className="flex justify-end p-3 border-t border-[var(--color-border)]">
          <button onClick={closeDialog} className="px-3 py-1.5 text-xs rounded border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
