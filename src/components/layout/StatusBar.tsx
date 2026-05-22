import { usePanelStore } from '../../stores/panelStore';
import { formatFileSize } from '../../utils/formatters';

export function StatusBar() {
  const tab = usePanelStore((s) => {
    const panel = s[s.activeSide];
    return panel.tabs[panel.activeTabIndex];
  });
  if (!tab) return null;

  const totalFiles = tab.files.filter((f) => !f.isDirectory).length;
  const totalDirs = tab.files.filter((f) => f.isDirectory).length;
  const selectedCount = tab.selectedFiles.size;

  const totalSize = tab.files
    .filter((f) => !f.isDirectory)
    .reduce((sum, f) => sum + f.size, 0);

  const selectedSize = tab.files
    .filter((f) => tab.selectedFiles.has(f.path) && !f.isDirectory)
    .reduce((sum, f) => sum + f.size, 0);

  return (
    <div className="flex items-center justify-between h-6 bg-[var(--color-bg-secondary)] border-t border-[var(--color-border)] px-3 text-xs text-[var(--color-text-muted)]">
      <span>
        {totalDirs} dir, {totalFiles} files ({formatFileSize(totalSize)})
      </span>
      {selectedCount > 0 && (
        <span className="text-[var(--color-accent)]">
          {selectedCount} selected ({formatFileSize(selectedSize)})
        </span>
      )}
      <span>{tab.currentPath}</span>
    </div>
  );
}
