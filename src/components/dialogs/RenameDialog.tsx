import { useState, useRef, useEffect } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { usePanelStore } from '../../stores/panelStore';
import { renameItem } from '../../services/localFs';

export function RenameDialog() {
  const closeDialog = useUIStore((s) => s.closeDialog);
  const dialogData = useUIStore((s) => s.dialogData);
  const activeSide = usePanelStore((s) => s.activeSide);
  const refreshPanel = usePanelStore((s) => s.refreshPanel);

  const originalPath = dialogData.path as string || '';
  const originalName = originalPath.split('/').pop() || '';

  const [name, setName] = useState(originalName);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      const dotIndex = originalName.lastIndexOf('.');
      if (dotIndex > 0) {
        inputRef.current.setSelectionRange(0, dotIndex);
      } else {
        inputRef.current.select();
      }
    }
  }, [originalName]);

  const handleSubmit = async () => {
    if (!name.trim() || name === originalName) {
      closeDialog();
      return;
    }

    const parentPath = originalPath.substring(0, originalPath.lastIndexOf('/'));
    const newPath = `${parentPath}/${name.trim()}`;

    try {
      await renameItem(originalPath, newPath);
      await refreshPanel(activeSide);
      closeDialog();
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={closeDialog}>
      <div
        className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-xl w-96 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
          Rename (Shift+F6)
        </h3>
        <p className="text-xs text-[var(--color-text-muted)] mb-2">
          Rename: {originalName}
        </p>
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => { setName(e.target.value); setError(''); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
            if (e.key === 'Escape') closeDialog();
          }}
          className="w-full bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-3 py-2 text-sm rounded border border-[var(--color-border)] outline-none focus:border-[var(--color-accent)]"
        />
        {error && (
          <p className="text-xs text-[var(--color-archive)] mt-2">{error}</p>
        )}
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={closeDialog}
            className="px-4 py-1.5 text-xs rounded bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-active)]"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-1.5 text-xs rounded bg-[var(--color-accent)] text-[var(--color-bg-primary)] hover:bg-[var(--color-accent-hover)] font-semibold"
          >
            Rename
          </button>
        </div>
      </div>
    </div>
  );
}
