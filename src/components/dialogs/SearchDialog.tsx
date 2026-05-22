import { useState, useRef, useEffect } from 'react';
import { Search, Loader2, X } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { usePanelStore } from '../../stores/panelStore';
import { invoke } from '@tauri-apps/api/core';
import type { FileEntry } from '../../types';

export function SearchDialog() {
  const closeDialog = useUIStore((s) => s.closeDialog);
  const activeSide = usePanelStore((s) => s.activeSide);
  const tab = usePanelStore((s) => {
    const panel = s[s.activeSide];
    return panel.tabs[panel.activeTabIndex];
  });
  const loadDirectory = usePanelStore((s) => s.loadDirectory);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FileEntry[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSearch = async () => {
    if (!query.trim() || !tab) return;
    setSearching(true);
    setResults([]);
    try {
      const found = await invoke<FileEntry[]>('search_files', {
        startPath: tab.currentPath,
        pattern: query.trim(),
      });
      setResults(found);
    } catch (e) {
      console.error('Search failed:', e);
    } finally {
      setSearching(false);
    }
  };

  const handleGoTo = (file: FileEntry) => {
    const parentDir = file.path.substring(0, file.path.lastIndexOf('/'));
    loadDirectory(activeSide, parentDir);
    closeDialog();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={closeDialog}>
      <div
        className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-xl w-[500px] max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-3 border-b border-[var(--color-border)]">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Search Files (Alt+F7)
          </h3>
          <button onClick={closeDialog} className="p-1 hover:bg-[var(--color-bg-hover)] rounded">
            <X size={14} />
          </button>
        </div>

        <div className="p-3 border-b border-[var(--color-border)]">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch();
                if (e.key === 'Escape') closeDialog();
              }}
              placeholder="File name pattern (e.g. *.txt, config*)"
              className="flex-1 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-3 py-2 text-sm rounded border border-[var(--color-border)] outline-none focus:border-[var(--color-accent)]"
            />
            <button
              onClick={handleSearch}
              disabled={searching}
              className="px-4 py-2 text-xs rounded bg-[var(--color-accent)] text-[var(--color-bg-primary)] hover:bg-[var(--color-accent-hover)] font-semibold disabled:opacity-50 flex items-center gap-1"
            >
              {searching ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
              Search
            </button>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Searching in: {tab?.currentPath}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-2 min-h-[100px] max-h-[400px]">
          {results.length === 0 && !searching && (
            <p className="text-xs text-[var(--color-text-muted)] text-center py-8">
              {query ? 'No results found' : 'Enter a pattern and click Search'}
            </p>
          )}
          {searching && (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-[var(--color-accent)]" />
            </div>
          )}
          {results.map((file) => (
            <button
              key={file.path}
              onClick={() => handleGoTo(file)}
              className="w-full text-left px-2 py-1 text-xs hover:bg-[var(--color-bg-hover)] rounded flex items-center gap-2"
            >
              <span className={file.isDirectory ? 'text-[var(--color-dir)]' : 'text-[var(--color-text-primary)]'}>
                {file.name}
              </span>
              <span className="text-[var(--color-text-muted)] truncate ml-auto">
                {file.path}
              </span>
            </button>
          ))}
          {results.length > 0 && (
            <p className="text-xs text-[var(--color-text-muted)] mt-2 px-2">
              {results.length} result(s) found
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
