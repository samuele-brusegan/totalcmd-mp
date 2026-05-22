import { useMemo, useState } from 'react';
import { X, ArrowRight } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { usePanelStore } from '../../stores/panelStore';
import { renameItem } from '../../services/localFs';

interface RenameEntry {
  originalPath: string;
  originalName: string;
  newName: string;
}

function applyPattern(name: string, ext: string, pattern: string, index: number): string {
  let result = pattern;
  result = result.replace(/\[N\]/gi, name);
  result = result.replace(/\[E\]/gi, ext);
  result = result.replace(/\[C(\d*)\]/gi, (_, start) => {
    const s = parseInt(start) || 1;
    return String(s + index);
  });
  result = result.replace(/\[C(\d*):(\d+)\]/gi, (_, start, pad) => {
    const s = parseInt(start) || 1;
    const p = parseInt(pad) || 1;
    return String(s + index).padStart(p, '0');
  });
  return result;
}

export function MultiRenameDialog() {
  const closeDialog = useUIStore((s) => s.closeDialog);
  const dialogData = useUIStore((s) => s.dialogData);
  const activeSide = usePanelStore((s) => s.activeSide);
  const refreshPanel = usePanelStore((s) => s.refreshPanel);

  const paths = useMemo(() => (dialogData.paths as string[]) || [], [dialogData.paths]);

  const [namePattern, setNamePattern] = useState('[N]');
  const [extPattern, setExtPattern] = useState('[E]');
  const [searchStr, setSearchStr] = useState('');
  const [replaceStr, setReplaceStr] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<string[]>([]);

  const entries: RenameEntry[] = useMemo(() => {
    return paths.map((p, i) => {
      const fullName = p.split('/').pop() || '';
      const dotIdx = fullName.lastIndexOf('.');
      const baseName = dotIdx > 0 ? fullName.substring(0, dotIdx) : fullName;
      const ext = dotIdx > 0 ? fullName.substring(dotIdx + 1) : '';

      let newBase = applyPattern(baseName, ext, namePattern, i);
      let newExt = applyPattern(baseName, ext, extPattern, i);

      if (searchStr) {
        newBase = newBase.split(searchStr).join(replaceStr);
        newExt = newExt.split(searchStr).join(replaceStr);
      }

      const newName = newExt ? `${newBase}.${newExt}` : newBase;

      return {
        originalPath: p,
        originalName: fullName,
        newName,
      };
    });
  }, [paths, namePattern, extPattern, searchStr, replaceStr]);

  const handleRename = async () => {
    setRenaming(true);
    setError(null);
    const log: string[] = [];

    for (const entry of entries) {
      if (entry.originalName === entry.newName) {
        log.push(`Skipped: ${entry.originalName} (unchanged)`);
        continue;
      }
      const dir = entry.originalPath.substring(0, entry.originalPath.lastIndexOf('/'));
      const newPath = `${dir}/${entry.newName}`;
      try {
        await renameItem(entry.originalPath, newPath);
        log.push(`OK: ${entry.originalName} → ${entry.newName}`);
      } catch (e) {
        log.push(`FAIL: ${entry.originalName} → ${e}`);
      }
    }

    setResults(log);
    setRenaming(false);
    await refreshPanel(activeSide);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={closeDialog}>
      <div
        className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-xl w-[600px] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-3 border-b border-[var(--color-border)]">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Multi-Rename Tool ({paths.length} files)
          </h3>
          <button onClick={closeDialog} className="p-1 hover:bg-[var(--color-bg-hover)] rounded">
            <X size={14} />
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-[var(--color-text-muted)]">Name pattern</span>
              <input
                value={namePattern}
                onChange={(e) => setNamePattern(e.target.value)}
                className="mt-0.5 w-full bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-2 py-1.5 text-xs rounded border border-[var(--color-border)] outline-none focus:border-[var(--color-accent)] font-mono"
                placeholder="[N]"
              />
            </label>
            <label className="block">
              <span className="text-xs text-[var(--color-text-muted)]">Extension pattern</span>
              <input
                value={extPattern}
                onChange={(e) => setExtPattern(e.target.value)}
                className="mt-0.5 w-full bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-2 py-1.5 text-xs rounded border border-[var(--color-border)] outline-none focus:border-[var(--color-accent)] font-mono"
                placeholder="[E]"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-[var(--color-text-muted)]">Search</span>
              <input
                value={searchStr}
                onChange={(e) => setSearchStr(e.target.value)}
                className="mt-0.5 w-full bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-2 py-1.5 text-xs rounded border border-[var(--color-border)] outline-none focus:border-[var(--color-accent)]"
                placeholder="Find text..."
              />
            </label>
            <label className="block">
              <span className="text-xs text-[var(--color-text-muted)]">Replace</span>
              <input
                value={replaceStr}
                onChange={(e) => setReplaceStr(e.target.value)}
                className="mt-0.5 w-full bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-2 py-1.5 text-xs rounded border border-[var(--color-border)] outline-none focus:border-[var(--color-accent)]"
                placeholder="Replace with..."
              />
            </label>
          </div>

          <div className="text-[10px] text-[var(--color-text-muted)]">
            Placeholders: [N] = name, [E] = extension, [C] = counter, [C1:3] = counter from 1 padded to 3 digits
          </div>

          <div className="border border-[var(--color-border)] rounded max-h-[200px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-[var(--color-text-muted)]">
                  <th className="text-left px-2 py-1 font-normal">Original</th>
                  <th className="w-6" />
                  <th className="text-left px-2 py-1 font-normal">New name</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr
                    key={i}
                    className={`border-b border-[var(--color-border)]/30 ${
                      e.originalName !== e.newName ? '' : 'opacity-50'
                    }`}
                  >
                    <td className="px-2 py-0.5 text-[var(--color-text-primary)] truncate max-w-[200px]">
                      {e.originalName}
                    </td>
                    <td className="text-center">
                      <ArrowRight size={10} className="text-[var(--color-text-muted)]" />
                    </td>
                    <td className={`px-2 py-0.5 truncate max-w-[200px] ${
                      e.originalName !== e.newName ? 'text-[var(--color-accent)] font-semibold' : 'text-[var(--color-text-muted)]'
                    }`}>
                      {e.newName}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {results.length > 0 && (
            <div className="border border-[var(--color-border)] rounded p-2 max-h-[100px] overflow-y-auto">
              {results.map((r, i) => (
                <div key={i} className={`text-[10px] ${r.startsWith('FAIL') ? 'text-red-400' : 'text-green-400'}`}>
                  {r}
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="p-2 rounded text-xs bg-red-900/30 text-red-300 border border-red-700">{error}</div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={closeDialog} className="px-3 py-1.5 text-xs rounded border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]">
              Close
            </button>
            <button
              onClick={handleRename}
              disabled={renaming || entries.every((e) => e.originalName === e.newName)}
              className="px-4 py-1.5 text-xs rounded bg-[var(--color-accent)] text-[var(--color-bg-primary)] hover:bg-[var(--color-accent-hover)] font-semibold disabled:opacity-50"
            >
              {renaming ? 'Renaming...' : 'Rename All'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
