import { useState, useEffect } from 'react';
import { HardDrive, X } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { usePanelStore } from '../../stores/panelStore';
import { getDrives } from '../../services/localFs';
import type { DriveInfo, PanelSide } from '../../types';

export function DriveSelector({ side }: { side?: PanelSide }) {
  const closeDialog = useUIStore((s) => s.closeDialog);
  const activeSide = usePanelStore((s) => s.activeSide);
  const loadDirectory = usePanelStore((s) => s.loadDirectory);
  const targetSide = side || activeSide;
  const [drives, setDrives] = useState<DriveInfo[]>([]);

  useEffect(() => {
    getDrives().then(setDrives).catch(console.error);
  }, []);

  const handleSelect = (mountPoint: string) => {
    loadDirectory(targetSide, mountPoint);
    closeDialog();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={closeDialog}>
      <div
        className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-xl w-[320px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-3 border-b border-[var(--color-border)]">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Select Drive
          </h3>
          <button onClick={closeDialog} className="p-1 hover:bg-[var(--color-bg-hover)] rounded">
            <X size={14} />
          </button>
        </div>
        <div className="p-2 max-h-[300px] overflow-y-auto">
          {drives.map((drive) => (
            <button
              key={drive.mountPoint}
              onClick={() => handleSelect(drive.mountPoint)}
              className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-[var(--color-bg-hover)] rounded"
            >
              <HardDrive size={16} className="text-[var(--color-accent)]" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-[var(--color-text-primary)] truncate">
                  {drive.name || drive.mountPoint}
                </div>
                <div className="text-[10px] text-[var(--color-text-muted)]">
                  {drive.mountPoint}
                  {drive.totalSpace != null && drive.availableSpace != null && (
                    <span className="ml-2">
                      {formatSize(drive.availableSpace)} free / {formatSize(drive.totalSpace)}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
          {drives.length === 0 && (
            <p className="text-xs text-[var(--color-text-muted)] text-center py-4">
              No drives detected
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
