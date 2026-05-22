import { useState, useRef, useEffect } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { usePanelStore } from '../../stores/panelStore';

export function QuickFilterDialog() {
  const closeDialog = useUIStore((s) => s.closeDialog);
  const activeSide = usePanelStore((s) => s.activeSide);
  const setFilter = usePanelStore((s) => s.setFilter);
  const tab = usePanelStore((s) => {
    const panel = s[s.activeSide];
    return panel.tabs[panel.activeTabIndex];
  });
  const [value, setValue] = useState(tab?.filter || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setFilter(activeSide, value);
  }, [value, activeSide, setFilter]);

  const handleClose = () => {
    closeDialog();
  };

  const handleClear = () => {
    setValue('');
    setFilter(activeSide, '');
    closeDialog();
  };

  return (
    <div className="fixed bottom-14 left-1/2 -translate-x-1/2 z-50">
      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-xl px-3 py-2 flex items-center gap-2">
        <span className="text-xs text-[var(--color-text-muted)]">Filter:</span>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') handleClose();
            if (e.key === 'Enter') handleClose();
          }}
          placeholder="Type to filter..."
          className="w-48 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-2 py-1 text-xs rounded border border-[var(--color-border)] outline-none focus:border-[var(--color-accent)]"
        />
        <button
          onClick={handleClear}
          className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] px-1"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
