import { useUIStore } from '../../stores/uiStore';
import { useEffect, useRef } from 'react';

export function DeleteConfirmDialog() {
  const closeDialog = useUIStore((s) => s.closeDialog);
  const dialogData = useUIStore((s) => s.dialogData);
  const btnRef = useRef<HTMLButtonElement>(null);

  const message = (dialogData.message as string) || 'Delete selected items?';
  const onConfirm = dialogData.onConfirm as (() => Promise<void>) | undefined;

  useEffect(() => {
    btnRef.current?.focus();
  }, []);

  const handleConfirm = async () => {
    if (onConfirm) {
      await onConfirm();
    }
    closeDialog();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={closeDialog}>
      <div
        className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-xl w-96 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-[var(--color-archive)] mb-3">
          Delete (F8)
        </h3>
        <p className="text-xs text-[var(--color-text-primary)] whitespace-pre-wrap mb-4">
          {message}
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={closeDialog}
            className="px-4 py-1.5 text-xs rounded bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-active)]"
          >
            Cancel
          </button>
          <button
            ref={btnRef}
            onClick={handleConfirm}
            onKeyDown={(e) => {
              if (e.key === 'Escape') closeDialog();
              if (e.key === 'Enter') handleConfirm();
            }}
            className="px-4 py-1.5 text-xs rounded bg-[var(--color-archive)] text-white hover:opacity-90 font-semibold"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
