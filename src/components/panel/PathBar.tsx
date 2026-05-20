import { useState, useRef, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { usePanelStore } from '../../stores/panelStore';
import type { PanelSide } from '../../types';

interface PathBarProps {
  side: PanelSide;
}

export function PathBar({ side }: PathBarProps) {
  const getActiveTab = usePanelStore((s) => s.getActiveTab);
  const loadDirectory = usePanelStore((s) => s.loadDirectory);
  const tab = getActiveTab(side);

  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const currentPath = tab?.currentPath || '/';

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const segments = currentPath.split('/').filter(Boolean);

  const handleSegmentClick = (index: number) => {
    const path = '/' + segments.slice(0, index + 1).join('/');
    loadDirectory(side, path);
  };

  const handleEditSubmit = () => {
    setEditing(false);
    if (editValue.trim()) {
      loadDirectory(side, editValue.trim());
    }
  };

  const handleStartEdit = () => {
    setEditValue(currentPath);
    setEditing(true);
  };

  if (editing) {
    return (
      <div className="flex items-center h-7 bg-[var(--color-bg-primary)] border-b border-[var(--color-border)] px-2">
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleEditSubmit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleEditSubmit();
            if (e.key === 'Escape') setEditing(false);
          }}
          className="w-full bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] px-2 py-0.5 text-xs rounded border border-[var(--color-accent)] outline-none"
        />
      </div>
    );
  }

  return (
    <div
      className="flex items-center h-7 bg-[var(--color-bg-primary)] border-b border-[var(--color-border)] px-2 overflow-x-auto cursor-pointer"
      onDoubleClick={handleStartEdit}
    >
      <button
        onClick={() => loadDirectory(side, '/')}
        className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent)] px-1 flex-shrink-0"
      >
        /
      </button>
      {segments.map((segment, index) => (
        <div key={index} className="flex items-center flex-shrink-0">
          <ChevronRight size={10} className="text-[var(--color-text-muted)] mx-0.5" />
          <button
            onClick={() => handleSegmentClick(index)}
            className="text-xs hover:text-[var(--color-accent)] px-1 text-[var(--color-text-secondary)]"
          >
            {segment}
          </button>
        </div>
      ))}
    </div>
  );
}
