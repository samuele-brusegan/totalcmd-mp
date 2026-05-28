import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Folder, File, FileArchive, Link2, Loader2 } from 'lucide-react';
import { usePanelStore } from '../../stores/panelStore';
import { formatFileSize, formatDate, getFileTypeClass } from '../../utils/formatters';
import { copyAcrossPanels } from '../../services/transfer';
import type { PanelSide, FileEntry } from '../../types';

interface FileListProps {
  side: PanelSide;
}

function FileIcon({ entry }: { entry: FileEntry }) {
  if (entry.isDirectory) return <Folder size={14} className="text-[var(--color-dir)] flex-shrink-0" />;
  if (entry.isSymlink) return <Link2 size={14} className="text-[var(--color-symlink)] flex-shrink-0" />;

  const archiveExts = ['zip', 'tar', 'gz', 'bz2', '7z', 'rar', 'xz', 'tgz'];
  if (entry.extension && archiveExts.includes(entry.extension.toLowerCase())) {
    return <FileArchive size={14} className="text-[var(--color-archive)] flex-shrink-0" />;
  }
  return <File size={14} className="text-[var(--color-text-muted)] flex-shrink-0" />;
}

export function FileList({ side }: FileListProps) {
  const tab = usePanelStore((s) => s[side].tabs[s[side].activeTabIndex]);
  const activeSide = usePanelStore((s) => s.activeSide);
  const setActiveSide = usePanelStore((s) => s.setActiveSide);
  const setCursorIndex = usePanelStore((s) => s.setCursorIndex);
  const toggleFileSelection = usePanelStore((s) => s.toggleFileSelection);
  const loadDirectory = usePanelStore((s) => s.loadDirectory);
  const navigateUp = usePanelStore((s) => s.navigateUp);

  const refreshPanel = usePanelStore((s) => s.refreshPanel);
  const listRef = useRef<HTMLDivElement>(null);
  const isActive = activeSide === side;
  const [dragOver, setDragOver] = useState(false);
  const quickSearchRef = useRef<{ buffer: string; timer: ReturnType<typeof setTimeout> | null }>({
    buffer: '',
    timer: null,
  });

  const filteredFiles = useMemo(() => {
    if (!tab) return [];
    if (!tab.filter) return tab.files;
    return tab.files.filter((f) =>
      f.name.toLowerCase().includes(tab.filter.toLowerCase())
    );
  }, [tab]);

  const handleItemClick = useCallback(
    (index: number, e: React.MouseEvent) => {
      if (!isActive) setActiveSide(side);
      setCursorIndex(side, index);

      if (e.ctrlKey || e.metaKey) {
        const file = filteredFiles[index];
        if (file) toggleFileSelection(side, file.path);
      }
    },
    [side, isActive, setActiveSide, setCursorIndex, toggleFileSelection, filteredFiles]
  );

  const handleItemDoubleClick = useCallback(
    (index: number) => {
      const file = filteredFiles[index];
      if (!file) return;

      if (file.isDirectory) {
        loadDirectory(side, file.path);
      }
    },
    [side, filteredFiles, loadDirectory]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!tab || !isActive) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setCursorIndex(side, Math.min(tab.cursorIndex + 1, filteredFiles.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setCursorIndex(side, Math.max(tab.cursorIndex - 1, -1));
          break;
        case 'Home':
          e.preventDefault();
          setCursorIndex(side, -1);
          break;
        case 'End':
          e.preventDefault();
          setCursorIndex(side, filteredFiles.length - 1);
          break;
        case 'PageDown':
          e.preventDefault();
          setCursorIndex(side, Math.min(tab.cursorIndex + 20, filteredFiles.length - 1));
          break;
        case 'PageUp':
          e.preventDefault();
          setCursorIndex(side, Math.max(tab.cursorIndex - 20, -1));
          break;
        case 'Enter': {
          if (tab.cursorIndex === -1) {
            navigateUp(side);
            break;
          }
          const file = filteredFiles[tab.cursorIndex];
          if (file?.isDirectory) {
            loadDirectory(side, file.path);
          }
          break;
        }
        case 'Backspace':
          e.preventDefault();
          navigateUp(side);
          break;
        case ' ':
        case 'Insert':
          e.preventDefault();
          {
            const file = filteredFiles[tab.cursorIndex];
            if (file) {
              // Advance only when selecting (not when deselecting), so the
              // user can quickly clear a wrong selection without losing
              // their place in the list.
              const wasSelected = tab.selectedFiles.has(file.path);
              toggleFileSelection(side, file.path);
              if (!wasSelected) {
                setCursorIndex(
                  side,
                  Math.min(tab.cursorIndex + 1, filteredFiles.length - 1)
                );
              }
            }
          }
          break;
        default: {
          // Quick search: typing printable chars jumps to matching file/dir.
          // Single key presses cycle through matches; consecutive keys build up a prefix buffer.
          if (
            e.key.length === 1 &&
            !e.ctrlKey &&
            !e.altKey &&
            !e.metaKey &&
            /^[\w.\- ]$/i.test(e.key)
          ) {
            e.preventDefault();
            e.stopPropagation();

            const ch = e.key.toLowerCase();
            const qs = quickSearchRef.current;
            if (qs.timer) clearTimeout(qs.timer);

            let buffer = qs.buffer + ch;

            // Special case: ".." moves cursor onto the parent (..) entry
            if (buffer === '..') {
              setCursorIndex(side, -1);
              qs.buffer = '';
              qs.timer = null;
              break;
            }
            const matches = (name: string) => name.toLowerCase().startsWith(buffer);
            let matchIdx = filteredFiles.findIndex((f) => matches(f.name));

            // If appending the new char yields no match, restart buffer with just this char
            if (matchIdx === -1 && buffer.length > 1) {
              buffer = ch;
              matchIdx = filteredFiles.findIndex((f) => f.name.toLowerCase().startsWith(buffer));
            }

            // If buffer is a single char and cursor already on a match, cycle to next match
            if (buffer.length === 1) {
              const cursorFile = filteredFiles[tab.cursorIndex];
              if (cursorFile && cursorFile.name.toLowerCase().startsWith(buffer)) {
                const next = filteredFiles.findIndex(
                  (f, i) => i > tab.cursorIndex && f.name.toLowerCase().startsWith(buffer)
                );
                matchIdx = next !== -1 ? next : matchIdx;
              }
            }

            if (matchIdx !== -1) {
              setCursorIndex(side, matchIdx);
            }

            qs.buffer = buffer;
            qs.timer = setTimeout(() => {
              qs.buffer = '';
              qs.timer = null;
            }, 1000);
          }
          break;
        }
      }
    },
    [tab, isActive, side, filteredFiles, setCursorIndex, loadDirectory, navigateUp, toggleFileSelection]
  );

  useEffect(() => {
    if (isActive && listRef.current) {
      listRef.current.focus();
    }
  }, [isActive]);

  useEffect(() => {
    if (!listRef.current || !tab) return;
    const cursorEl = listRef.current.querySelector(`[data-index="${tab.cursorIndex}"]`);
    cursorEl?.scrollIntoView({ block: 'nearest' });
  }, [tab?.cursorIndex, tab]);

  const handleDragStart = useCallback(
    (e: React.DragEvent, file: FileEntry) => {
      const paths = tab?.selectedFiles.size
        ? Array.from(tab.selectedFiles)
        : [file.path];
      e.dataTransfer.setData('application/json', JSON.stringify({ paths, sourceSide: side }));
      e.dataTransfer.effectAllowed = 'copyMove';
    },
    [tab, side]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const data = e.dataTransfer.getData('application/json');
      if (!data || !tab) return;

      try {
        const { paths, sourceSide } = JSON.parse(data) as { paths: string[]; sourceSide: PanelSide };
        if (sourceSide === side) return;
        const sourceTab = usePanelStore.getState().getActiveTab(sourceSide);
        if (!sourceTab) return;
        await copyAcrossPanels({
          sourceTab,
          sourcePaths: paths,
          destTab: tab,
          destDir: tab.currentPath,
        });
        await refreshPanel(side);
      } catch (err) {
        console.error('Drop copy failed:', err);
        alert(`Drop copy failed: ${err}`);
      }
    },
    [tab, side, refreshPanel]
  );

  if (!tab) return null;

  if (tab.loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-[var(--color-accent)]" />
      </div>
    );
  }

  if (tab.error) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--color-archive)] text-xs px-4 text-center">
        {tab.error}
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClick={() => { if (!isActive) setActiveSide(side); }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex-1 overflow-y-auto outline-none ${isActive ? '' : 'opacity-80'} ${dragOver ? 'ring-2 ring-inset ring-[var(--color-accent)]/50' : ''}`}
    >
      {/* Parent directory entry */}
      <div
        data-index={-1}
        onClick={() => {
          if (!isActive) setActiveSide(side);
          setCursorIndex(side, -1);
        }}
        className={`flex items-center h-6 px-2 cursor-pointer text-[var(--color-dir)] ${
          tab.cursorIndex === -1 && isActive
            ? 'bg-[var(--color-bg-selected)]'
            : 'hover:bg-[var(--color-bg-hover)]'
        }`}
        onDoubleClick={() => navigateUp(side)}
      >
        <div className="w-5 flex-shrink-0">
          <Folder size={14} />
        </div>
        <div className="flex-1 min-w-0 px-1 text-xs font-bold">..</div>
        <div className="w-16 px-1 text-xs">&lt;DIR&gt;</div>
        <div className="w-24 px-1 text-xs text-right" />
        <div className="w-36 px-1 text-xs" />
        <div className="w-20 px-1 text-xs" />
      </div>

      {filteredFiles.map((file, index) => {
        const isCursor = tab.cursorIndex === index && isActive;
        const isSelected = tab.selectedFiles.has(file.path);

        return (
          <div
            key={file.path}
            data-index={index}
            draggable
            onDragStart={(e) => handleDragStart(e, file)}
            onClick={(e) => handleItemClick(index, e)}
            onDoubleClick={() => handleItemDoubleClick(index)}
            className={`flex items-center h-6 px-2 cursor-pointer text-xs ${
              isCursor
                ? 'bg-[var(--color-bg-selected)]'
                : isSelected
                ? 'bg-[var(--color-bg-hover)]'
                : 'hover:bg-[var(--color-bg-hover)]'
            } ${isSelected ? 'font-semibold' : ''}`}
          >
            <div className="w-5 flex-shrink-0">
              <FileIcon entry={file} />
            </div>
            <div className={`flex-1 min-w-0 px-1 truncate ${getFileTypeClass(file)}`}>
              {file.name}
            </div>
            <div className="w-16 px-1 text-[var(--color-text-muted)] truncate">
              {file.isDirectory ? '<DIR>' : file.extension || ''}
            </div>
            <div className="w-24 px-1 text-right text-[var(--color-text-secondary)]">
              {file.isDirectory ? '' : formatFileSize(file.size)}
            </div>
            <div className="w-36 px-1 text-[var(--color-text-muted)]">
              {formatDate(file.modified)}
            </div>
            <div className="w-20 px-1 text-[var(--color-text-muted)]">
              {file.permissions || ''}
            </div>
          </div>
        );
      })}

      {filteredFiles.length === 0 && (
        <div className="flex items-center justify-center h-20 text-[var(--color-text-muted)] text-xs">
          Empty directory
        </div>
      )}
    </div>
  );
}
