import { X, Pause, CheckCircle2, AlertCircle } from 'lucide-react';
import { useConnectionStore } from '../../stores/connectionStore';
import type { TransferItem } from '../../types';

export function TransferPanel() {
  const transfers = useConnectionStore((s) => s.transfers);
  const removeTransfer = useConnectionStore((s) => s.removeTransfer);
  const clearCompleted = useConnectionStore((s) => s.clearCompleted);

  if (transfers.length === 0) return null;

  const active = transfers.filter((t) => t.status === 'inprogress' || t.status === 'queued');
  const completed = transfers.filter((t) => t.status === 'completed');
  const failed = transfers.filter((t) => t.status === 'failed');

  return (
    <div className="border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
      <div className="flex items-center justify-between px-3 py-1 border-b border-[var(--color-border)]">
        <span className="text-[10px] text-[var(--color-text-muted)] font-semibold uppercase">
          Transfers ({active.length} active, {completed.length} done, {failed.length} failed)
        </span>
        {completed.length > 0 && (
          <button
            onClick={clearCompleted}
            className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          >
            Clear completed
          </button>
        )}
      </div>
      <div className="max-h-[120px] overflow-y-auto">
        {transfers.map((t) => (
          <TransferRow key={t.id} item={t} onRemove={() => removeTransfer(t.id)} />
        ))}
      </div>
    </div>
  );
}

function TransferRow({ item, onRemove }: { item: TransferItem; onRemove: () => void }) {
  const percent = item.size > 0 ? Math.round((item.transferred / item.size) * 100) : 0;

  return (
    <div className="flex items-center gap-2 px-3 py-1 hover:bg-[var(--color-bg-hover)] text-xs">
      {item.status === 'completed' && <CheckCircle2 size={12} className="text-green-400" />}
      {item.status === 'failed' && <AlertCircle size={12} className="text-red-400" />}
      {item.status === 'inprogress' && (
        <div className="w-3 h-3 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
      )}
      {item.status === 'queued' && <Pause size={12} className="text-[var(--color-text-muted)]" />}

      <span className="text-[var(--color-text-primary)] truncate flex-1">{item.fileName}</span>
      <span className="text-[var(--color-text-muted)] w-14 text-right">
        {item.status === 'inprogress' ? `${percent}%` : item.status}
      </span>

      {item.status === 'inprogress' && (
        <div className="w-20 h-1.5 bg-[var(--color-bg-primary)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--color-accent)] transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}

      <button onClick={onRemove} className="p-0.5 hover:bg-[var(--color-bg-hover)] rounded">
        <X size={10} />
      </button>
    </div>
  );
}
