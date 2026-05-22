import { useState, useEffect } from 'react';
import { X, FileText, Binary } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { readFileText } from '../../services/localFs';

type ViewMode = 'text' | 'hex';

export function FileViewerDialog() {
  const closeDialog = useUIStore((s) => s.closeDialog);
  const dialogData = useUIStore((s) => s.dialogData);
  const filePath = dialogData.path as string;

  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('text');
  const [wrapLines, setWrapLines] = useState(false);

  useEffect(() => {
    if (!filePath) return;
    let cancelled = false;
    readFileText(filePath)
      .then((text) => {
        if (!cancelled) {
          setContent(text);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(String(e));
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [filePath]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'F3' || e.key === 'q') {
        e.preventDefault();
        closeDialog();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [closeDialog]);

  const fileName = filePath?.split('/').pop() || '';

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-xl w-[80vw] h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-[var(--color-accent)]" />
            <span className="text-xs font-semibold text-[var(--color-text-primary)]">
              {fileName}
            </span>
            <span className="text-[10px] text-[var(--color-text-muted)] truncate max-w-[300px]">
              {filePath}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('text')}
              className={`p-1 rounded text-xs ${viewMode === 'text' ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)]'}`}
              title="Text view"
            >
              <FileText size={12} />
            </button>
            <button
              onClick={() => setViewMode('hex')}
              className={`p-1 rounded text-xs ${viewMode === 'hex' ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)]'}`}
              title="Hex view"
            >
              <Binary size={12} />
            </button>
            <label className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
              <input
                type="checkbox"
                checked={wrapLines}
                onChange={(e) => setWrapLines(e.target.checked)}
                className="w-3 h-3"
              />
              Wrap
            </label>
            <button onClick={closeDialog} className="p-1 hover:bg-[var(--color-bg-hover)] rounded ml-2">
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-0">
          {loading && (
            <div className="flex items-center justify-center h-full text-xs text-[var(--color-text-muted)]">
              Loading...
            </div>
          )}
          {error && (
            <div className="flex items-center justify-center h-full text-xs text-red-400 p-4">
              {error}
            </div>
          )}
          {!loading && !error && viewMode === 'text' && (
            <pre
              className={`text-xs text-[var(--color-text-primary)] p-3 font-mono leading-5 ${
                wrapLines ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'
              }`}
            >
              {content || '(empty file)'}
            </pre>
          )}
          {!loading && !error && viewMode === 'hex' && (
            <HexView content={content} />
          )}
        </div>

        <div className="flex items-center justify-between px-3 py-1 border-t border-[var(--color-border)] text-[10px] text-[var(--color-text-muted)]">
          <span>{content.length.toLocaleString()} characters</span>
          <span>Press Esc or Q to close</span>
        </div>
      </div>
    </div>
  );
}

function HexView({ content }: { content: string }) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(content);
  const lines: string[] = [];
  const BYTES_PER_LINE = 16;

  for (let i = 0; i < bytes.length && i < 65536; i += BYTES_PER_LINE) {
    const offset = i.toString(16).padStart(8, '0');
    const chunk = bytes.slice(i, i + BYTES_PER_LINE);
    const hex = Array.from(chunk)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(' ');
    const ascii = Array.from(chunk)
      .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.'))
      .join('');
    lines.push(`${offset}  ${hex.padEnd(47)}  ${ascii}`);
  }

  return (
    <pre className="text-xs text-[var(--color-text-primary)] p-3 font-mono leading-5 whitespace-pre">
      {lines.join('\n')}
      {bytes.length > 65536 && '\n\n... (truncated at 64KB)'}
    </pre>
  );
}
