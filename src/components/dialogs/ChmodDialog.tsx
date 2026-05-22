import { useState, useMemo } from 'react';
import { X } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useUIStore } from '../../stores/uiStore';
import { usePanelStore } from '../../stores/panelStore';

const PERM_BITS = [
  { label: 'Owner Read', bit: 0o400 },
  { label: 'Owner Write', bit: 0o200 },
  { label: 'Owner Exec', bit: 0o100 },
  { label: 'Group Read', bit: 0o040 },
  { label: 'Group Write', bit: 0o020 },
  { label: 'Group Exec', bit: 0o010 },
  { label: 'Other Read', bit: 0o004 },
  { label: 'Other Write', bit: 0o002 },
  { label: 'Other Exec', bit: 0o001 },
] as const;

function parsePermString(perm: string | null): number {
  if (!perm || perm.length < 10) return 0o644;
  let mode = 0;
  const map = 'rwxrwxrwx';
  for (let i = 0; i < 9; i++) {
    if (perm[i + 1] === map[i]) {
      mode |= 1 << (8 - i);
    }
  }
  return mode;
}

function modeToOctal(mode: number): string {
  return mode.toString(8).padStart(3, '0');
}

function modeToString(mode: number): string {
  let s = '';
  const chars = 'rwxrwxrwx';
  for (let i = 0; i < 9; i++) {
    s += mode & (1 << (8 - i)) ? chars[i] : '-';
  }
  return s;
}

export function ChmodDialog() {
  const closeDialog = useUIStore((s) => s.closeDialog);
  const dialogData = useUIStore((s) => s.dialogData);
  const activeSide = usePanelStore((s) => s.activeSide);
  const refreshPanel = usePanelStore((s) => s.refreshPanel);

  const filePath = dialogData.path as string;
  const currentPerms = dialogData.permissions as string | null;
  const isRemote = dialogData.isRemote as boolean | undefined;
  const connectionId = dialogData.connectionId as string | undefined;

  const [mode, setMode] = useState(() => parsePermString(currentPerms));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const octalDisplay = useMemo(() => modeToOctal(mode), [mode]);

  const toggleBit = (bit: number) => {
    setMode((prev) => prev ^ bit);
  };

  const handleOctalChange = (val: string) => {
    const num = parseInt(val, 8);
    if (!isNaN(num) && num >= 0 && num <= 0o777) {
      setMode(num);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      if (isRemote && connectionId) {
        await invoke('remote_chmod', { connectionId, path: filePath, mode });
      } else {
        await invoke('chmod_local', { path: filePath, mode });
      }
      await refreshPanel(activeSide);
      closeDialog();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const fileName = filePath?.split('/').pop() || '';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={closeDialog}>
      <div
        className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-xl w-[340px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-3 border-b border-[var(--color-border)]">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Permissions</h3>
          <button onClick={closeDialog} className="p-1 hover:bg-[var(--color-bg-hover)] rounded">
            <X size={14} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="text-xs text-[var(--color-text-muted)] truncate">{fileName}</div>

          <div className="grid grid-cols-3 gap-x-4 gap-y-1">
            {['Owner', 'Group', 'Other'].map((group, gi) => (
              <div key={group} className="text-center">
                <div className="text-[10px] text-[var(--color-text-muted)] font-semibold mb-1">{group}</div>
                {['Read', 'Write', 'Exec'].map((perm, pi) => {
                  const bit = PERM_BITS[gi * 3 + pi].bit;
                  return (
                    <label key={perm} className="flex items-center gap-1.5 text-xs text-[var(--color-text-primary)] py-0.5">
                      <input
                        type="checkbox"
                        checked={(mode & bit) !== 0}
                        onChange={() => toggleBit(bit)}
                        className="w-3.5 h-3.5 rounded"
                      />
                      {perm}
                    </label>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 pt-1">
            <label className="text-xs text-[var(--color-text-muted)]">Octal:</label>
            <input
              value={octalDisplay}
              onChange={(e) => handleOctalChange(e.target.value)}
              maxLength={4}
              className="w-16 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-2 py-1 text-xs rounded border border-[var(--color-border)] outline-none focus:border-[var(--color-accent)] font-mono text-center"
            />
            <span className="text-xs text-[var(--color-text-muted)] font-mono">{modeToString(mode)}</span>
          </div>

          {error && (
            <div className="p-2 rounded text-xs bg-red-900/30 text-red-300 border border-red-700">{error}</div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={closeDialog} className="px-3 py-1.5 text-xs rounded border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 text-xs rounded bg-[var(--color-accent)] text-[var(--color-bg-primary)] hover:bg-[var(--color-accent-hover)] font-semibold disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Apply'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
