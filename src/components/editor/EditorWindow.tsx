import { useEffect, useState, useCallback } from 'react';
import { Save, X } from 'lucide-react';
import { readFileText } from '../../services/localFs';
import { writeFileText, finishRemoteEdit } from '../../services/editor';

interface EditorWindowProps {
  filePath: string;
  displayName: string;
  /** When set, the file is a temp copy of a remote path; we re-upload on close. */
  remote?: { connectionId: string; remotePath: string; originalMtimeMs: number };
}

export function EditorWindow({ filePath, displayName, remote }: EditorWindowProps) {
  const [content, setContent] = useState('');
  const [original, setOriginal] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    readFileText(filePath)
      .then((text) => {
        if (cancelled) return;
        setContent(text);
        setOriginal(text);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(String(e));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filePath]);

  const dirty = content !== original;

  const save = useCallback(async () => {
    if (saving || !dirty) return;
    setSaving(true);
    setStatus(null);
    try {
      await writeFileText(filePath, content);
      setOriginal(content);
      if (remote) {
        try {
          const uploaded = await finishRemoteEdit(
            remote.connectionId,
            remote.remotePath,
            filePath,
            remote.originalMtimeMs
          );
          setStatus(uploaded ? 'Saved & uploaded' : 'Saved');
        } catch (e) {
          setStatus(`Saved locally; upload failed: ${e}`);
        }
      } else {
        setStatus('Saved');
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }, [content, filePath, dirty, saving, remote]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  // Warn before close if dirty
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  return (
    <div className="flex flex-col h-screen w-screen bg-[var(--color-bg-primary)]">
      <div className="flex items-center gap-2 px-3 h-9 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <span className="text-xs font-semibold text-[var(--color-text-primary)] flex-1 truncate">
          {displayName}
          {dirty && <span className="text-[var(--color-accent)] ml-1">●</span>}
        </span>
        {status && (
          <span className="text-[10px] text-[var(--color-text-muted)]">{status}</span>
        )}
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="px-3 py-1 text-xs rounded bg-[var(--color-accent)] text-[var(--color-bg-primary)] font-semibold hover:bg-[var(--color-accent-hover)] disabled:opacity-40 flex items-center gap-1"
          title="Save (Ctrl+S)"
        >
          <Save size={12} />
          Save
        </button>
        <button
          onClick={() => window.close()}
          className="p-1 hover:bg-[var(--color-bg-hover)] rounded"
          title="Close"
        >
          <X size={14} />
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-xs text-[var(--color-text-muted)]">
          Loading…
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center text-xs text-red-400 px-4 text-center">
          {error}
        </div>
      ) : (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          spellCheck={false}
          className="flex-1 w-full p-3 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] font-mono text-xs leading-5 outline-none resize-none border-0"
        />
      )}
    </div>
  );
}
