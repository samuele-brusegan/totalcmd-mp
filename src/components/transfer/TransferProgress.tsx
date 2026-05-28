import { useEffect, useMemo } from 'react';
import {
  Pause,
  Play,
  X,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  Activity,
} from 'lucide-react';
import {
  useTransferStore,
  type TransferProgress as TP,
} from '../../stores/transferStore';

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function pct(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((done / total) * 100)));
}

function statusColor(s: TP['status']): string {
  switch (s) {
    case 'done':
      return 'text-green-400';
    case 'error':
    case 'cancelled':
      return 'text-red-400';
    case 'paused':
      return 'text-yellow-300';
    default:
      return 'text-[var(--color-accent)]';
  }
}

function StatusIcon({ s }: { s: TP['status'] }) {
  if (s === 'done') return <CheckCircle2 size={12} className="text-green-400" />;
  if (s === 'error' || s === 'cancelled')
    return <AlertCircle size={12} className="text-red-400" />;
  if (s === 'paused') return <Pause size={12} className="text-yellow-300" />;
  return <Activity size={12} className="text-[var(--color-accent)] animate-pulse" />;
}

export function TransferProgress() {
  const transfers = useTransferStore((s) => s.transfers);
  const minimized = useTransferStore((s) => s.panelMinimized);
  const setMinimized = useTransferStore((s) => s.setMinimized);
  const cancel = useTransferStore((s) => s.cancel);
  const togglePause = useTransferStore((s) => s.togglePause);
  const removeTransfer = useTransferStore((s) => s.removeTransfer);
  const clearFinished = useTransferStore((s) => s.clearFinished);
  const startListening = useTransferStore((s) => s.startListening);

  useEffect(() => {
    startListening();
  }, [startListening]);

  const { active, finished } = useMemo(() => {
    const a: TP[] = [];
    const f: TP[] = [];
    for (const t of transfers) {
      if (t.status === 'running' || t.status === 'paused' || t.status === 'scanning') {
        a.push(t);
      } else {
        f.push(t);
      }
    }
    return { active: a, finished: f };
  }, [transfers]);

  if (transfers.length === 0) return null;

  // Minimized chip in the corner
  if (minimized) {
    const totalPct = active.length
      ? Math.round(
          active.reduce((acc, t) => acc + pct(t.bytesDone, t.bytesTotal), 0) /
            active.length
        )
      : 100;
    return (
      <button
        onClick={() => setMinimized(false)}
        className="border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] flex items-center gap-2 px-3 py-1 text-xs hover:bg-[var(--color-bg-hover)] w-full"
        title="Espandi pannello trasferimenti"
      >
        <Activity size={12} className="text-[var(--color-accent)] animate-pulse flex-shrink-0" />
        <span className="text-[var(--color-text-primary)]">
          {active.length} trasferimento{active.length === 1 ? '' : 'i'} attivo
          {active.length === 1 ? '' : 'i'}
        </span>
        <div className="flex-1 h-1.5 bg-[var(--color-bg-primary)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--color-accent)] transition-all"
            style={{ width: `${totalPct}%` }}
          />
        </div>
        <span className="text-[var(--color-text-muted)]">{totalPct}%</span>
        <ChevronUp size={12} className="text-[var(--color-text-muted)]" />
      </button>
    );
  }

  return (
    <div className="border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
      <div className="flex items-center justify-between px-3 py-1 border-b border-[var(--color-border)]">
        <span className="text-[10px] text-[var(--color-text-muted)] font-semibold uppercase">
          Trasferimenti — {active.length} attivi · {finished.length} terminati
        </span>
        <div className="flex items-center gap-2">
          {finished.length > 0 && (
            <button
              onClick={clearFinished}
              className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            >
              Pulisci terminati
            </button>
          )}
          <button
            onClick={() => setMinimized(true)}
            className="p-1 rounded hover:bg-[var(--color-bg-hover)]"
            title="Vai in background"
          >
            <ChevronDown size={12} />
          </button>
        </div>
      </div>

      <div className="max-h-[180px] overflow-y-auto">
        {transfers.map((t) => (
          <TransferRow
            key={t.transferId}
            t={t}
            onCancel={() => cancel(t.transferId)}
            onTogglePause={() => togglePause(t.transferId)}
            onRemove={() => removeTransfer(t.transferId)}
          />
        ))}
      </div>
    </div>
  );
}

function TransferRow({
  t,
  onCancel,
  onTogglePause,
  onRemove,
}: {
  t: TP;
  onCancel: () => void;
  onTogglePause: () => void;
  onRemove: () => void;
}) {
  const overallPct = pct(t.bytesDone, t.bytesTotal);
  const filePct = pct(t.fileBytes, t.fileTotal);
  // When the only file's bytes equal the totals, just show one bar.
  const singleFile = t.itemsTotal <= 1;
  const finished =
    t.status === 'done' || t.status === 'error' || t.status === 'cancelled';
  const fileName = t.currentFile.split(/[/\\]/).pop() || '';

  return (
    <div className="px-3 py-1.5 hover:bg-[var(--color-bg-hover)]/50 border-b border-[var(--color-border)]/40 last:border-b-0">
      <div className="flex items-center gap-2 text-xs">
        <StatusIcon s={t.status} />
        <span className="flex-1 truncate text-[var(--color-text-primary)]">
          {t.label}
        </span>
        <span className={`text-[10px] uppercase ${statusColor(t.status)}`}>
          {t.status}
        </span>
        {!finished && (
          <>
            <button
              onClick={onTogglePause}
              className="p-1 rounded hover:bg-[var(--color-bg-active)]"
              title={t.status === 'paused' ? 'Riprendi' : 'Pausa'}
            >
              {t.status === 'paused' ? <Play size={11} /> : <Pause size={11} />}
            </button>
            <button
              onClick={onCancel}
              className="p-1 rounded hover:bg-red-900/40 text-red-400"
              title="Annulla"
            >
              <X size={11} />
            </button>
          </>
        )}
        {finished && (
          <button
            onClick={onRemove}
            className="p-1 rounded hover:bg-[var(--color-bg-active)]"
            title="Rimuovi"
          >
            <X size={11} />
          </button>
        )}
      </div>

      {/* Overall progress */}
      <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--color-text-muted)]">
        <span className="w-12 text-right">{overallPct}%</span>
        <div className="flex-1 h-1.5 bg-[var(--color-bg-primary)] rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              t.status === 'error' || t.status === 'cancelled'
                ? 'bg-red-500'
                : t.status === 'done'
                ? 'bg-green-500'
                : 'bg-[var(--color-accent)]'
            }`}
            style={{ width: `${overallPct}%` }}
          />
        </div>
        <span className="w-32 text-right">
          {formatBytes(t.bytesDone)} / {t.bytesTotal > 0 ? formatBytes(t.bytesTotal) : '?'}
          {t.itemsTotal > 0 && (
            <>
              {' '}· {t.itemsDone}/{t.itemsTotal} file
            </>
          )}
        </span>
      </div>

      {/* Per-file progress (only if multi-file and there's a current file) */}
      {!singleFile && fileName && !finished && (
        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-[var(--color-text-muted)]">
          <span className="w-12 text-right">{filePct}%</span>
          <div className="flex-1 h-1 bg-[var(--color-bg-primary)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--color-accent)]/60 transition-all"
              style={{ width: `${filePct}%` }}
            />
          </div>
          <span className="flex-1 truncate text-left max-w-[200px]" title={t.currentFile}>
            {fileName}
          </span>
        </div>
      )}

      {t.message && (
        <div className="mt-0.5 text-[10px] text-red-300 truncate" title={t.message}>
          {t.message}
        </div>
      )}
    </div>
  );
}
