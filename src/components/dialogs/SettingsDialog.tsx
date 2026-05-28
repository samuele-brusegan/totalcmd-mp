import { useState } from 'react';
import { X, Monitor, Keyboard, Palette, FileEdit } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useSettingsStore } from '../../stores/settingsStore';

type SettingsTab = 'general' | 'appearance' | 'editor' | 'shortcuts';

export function SettingsDialog() {
  const closeDialog = useUIStore((s) => s.closeDialog);
  const settings = useSettingsStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  const tabs: { id: SettingsTab; label: string; icon: typeof Monitor }[] = [
    { id: 'general', label: 'General', icon: Monitor },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'editor', label: 'Editor', icon: FileEdit },
    { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={closeDialog}>
      <div
        className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-xl w-[560px] h-[420px] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-3 border-b border-[var(--color-border)]">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Settings</h3>
          <button onClick={closeDialog} className="p-1 hover:bg-[var(--color-bg-hover)] rounded">
            <X size={14} />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          <div className="w-[140px] border-r border-[var(--color-border)] p-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded text-xs ${
                  activeTab === tab.id
                    ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]'
                    : 'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]'
                }`}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 p-4 overflow-y-auto">
            {activeTab === 'general' && (
              <div className="space-y-4">
                <label className="flex items-center justify-between text-xs text-[var(--color-text-primary)]">
                  <span>Show hidden files</span>
                  <input
                    type="checkbox"
                    checked={settings.showHidden}
                    onChange={(e) => settings.setShowHidden(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                </label>
                <label className="flex items-center justify-between text-xs text-[var(--color-text-primary)]">
                  <span>Confirm file delete</span>
                  <input
                    type="checkbox"
                    checked={settings.confirmDelete}
                    onChange={(e) => settings.setConfirmDelete(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                </label>
                <label className="flex items-center justify-between text-xs text-[var(--color-text-primary)]">
                  <span>Confirm file overwrite</span>
                  <input
                    type="checkbox"
                    checked={settings.confirmOverwrite}
                    onChange={(e) => settings.setConfirmOverwrite(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                </label>
                <label className="block text-xs text-[var(--color-text-primary)]">
                  <span className="block mb-1">Default sort column</span>
                  <select
                    value={settings.defaultSortColumn}
                    onChange={(e) => settings.setDefaultSortColumn(e.target.value as 'name' | 'size' | 'modified' | 'extension')}
                    className="w-full bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-2 py-1.5 rounded border border-[var(--color-border)]"
                  >
                    <option value="name">Name</option>
                    <option value="size">Size</option>
                    <option value="modified">Date</option>
                    <option value="extension">Extension</option>
                  </select>
                </label>

                <label className="block text-xs text-[var(--color-text-primary)]">
                  <span className="block mb-1">
                    FTP/SFTP parallel transfers:{' '}
                    <span className="text-[var(--color-accent)] font-mono">
                      {settings.ftpParallelTransfers}
                    </span>
                  </span>
                  <input
                    type="range"
                    min={1}
                    max={16}
                    step={1}
                    value={settings.ftpParallelTransfers}
                    onChange={(e) =>
                      settings.setFtpParallelTransfers(parseInt(e.target.value, 10))
                    }
                    className="w-full accent-[var(--color-accent)]"
                  />
                  <span className="block mt-1 text-[10px] text-[var(--color-text-muted)] leading-snug">
                    Numero di connessioni simultanee per copie/upload/download
                    ricorsivi. Più alto = più veloce con tanti file piccoli, ma
                    molti server limitano le connessioni concorrenti per IP
                    (Tophost ~5-10). 1 = sequenziale.
                  </span>
                </label>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className="space-y-4">
                <label className="block text-xs text-[var(--color-text-primary)]">
                  <span className="block mb-1">Theme</span>
                  <select
                    value={settings.theme}
                    onChange={(e) => settings.setTheme(e.target.value as 'dark' | 'light')}
                    className="w-full bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-2 py-1.5 rounded border border-[var(--color-border)]"
                  >
                    <option value="dark">Dark (Catppuccin)</option>
                    <option value="light">Light</option>
                  </select>
                </label>
                <label className="block text-xs text-[var(--color-text-primary)]">
                  <span className="block mb-1">Font size</span>
                  <select
                    value={settings.fontSize}
                    onChange={(e) => settings.setFontSize(e.target.value as 'small' | 'medium' | 'large')}
                    className="w-full bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-2 py-1.5 rounded border border-[var(--color-border)]"
                  >
                    <option value="small">Small (11px)</option>
                    <option value="medium">Medium (12px)</option>
                    <option value="large">Large (14px)</option>
                  </select>
                </label>
                <label className="flex items-center justify-between text-xs text-[var(--color-text-primary)]">
                  <span>Show file icons</span>
                  <input
                    type="checkbox"
                    checked={settings.showIcons}
                    onChange={(e) => settings.setShowIcons(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                </label>
              </div>
            )}

            {activeTab === 'editor' && (
              <div className="space-y-4">
                <label className="block text-xs text-[var(--color-text-primary)]">
                  <span className="block mb-1">Editor mode (F4)</span>
                  <select
                    value={settings.editorMode}
                    onChange={(e) =>
                      settings.setEditorMode(e.target.value as 'internal' | 'external')
                    }
                    className="w-full bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-2 py-1.5 rounded border border-[var(--color-border)]"
                  >
                    <option value="internal">Internal (new window)</option>
                    <option value="external">External program</option>
                  </select>
                  <span className="block mt-1 text-[10px] text-[var(--color-text-muted)] leading-snug">
                    Internal: a new app window with a built-in editor (auto-uploads
                    edits to remote on save). External: spawn a configured program;
                    re-upload of remote files is manual in this mode.
                  </span>
                </label>

                {settings.editorMode === 'external' && (
                  <label className="block text-xs text-[var(--color-text-primary)]">
                    <span className="block mb-1">External editor command</span>
                    <input
                      type="text"
                      value={settings.externalEditorCommand}
                      onChange={(e) =>
                        settings.setExternalEditorCommand(e.target.value)
                      }
                      placeholder="e.g. code, gedit, kate, subl, notepad"
                      className="w-full bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-2 py-1.5 rounded border border-[var(--color-border)] font-mono"
                    />
                    <span className="block mt-1 text-[10px] text-[var(--color-text-muted)] leading-snug">
                      The file path is appended as the last argument. You can include
                      flags, e.g. <code>code --wait</code>.
                    </span>
                  </label>
                )}
              </div>
            )}

            {activeTab === 'shortcuts' && (
              <div className="space-y-1">
                <p className="text-xs text-[var(--color-text-muted)] mb-3">Keyboard shortcuts reference</p>
                {SHORTCUTS.map((s) => (
                  <div key={s.key} className="flex items-center justify-between text-xs py-1">
                    <span className="text-[var(--color-text-primary)]">{s.label}</span>
                    <kbd className="px-2 py-0.5 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded text-[10px] font-mono text-[var(--color-text-muted)]">
                      {s.key}
                    </kbd>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const SHORTCUTS = [
  { key: 'F2', label: 'Refresh' },
  { key: 'F3', label: 'View file' },
  { key: 'F4', label: 'Edit file' },
  { key: 'F5', label: 'Copy' },
  { key: 'F6', label: 'Move' },
  { key: 'Shift+F6', label: 'Rename' },
  { key: 'F7', label: 'Create directory' },
  { key: 'F8 / Del', label: 'Delete' },
  { key: 'Tab', label: 'Switch panel' },
  { key: 'Ctrl+A', label: 'Select all' },
  { key: 'Ctrl+S', label: 'Quick filter' },
  { key: 'Ctrl+Shift+F', label: 'Search files' },
  { key: 'Ctrl+F', label: 'Connection manager' },
  { key: 'Ctrl+T', label: 'New tab' },
  { key: 'Ctrl+W', label: 'Close tab' },
  { key: 'Alt+F1', label: 'Left drive selector' },
  { key: 'Alt+F2', label: 'Right drive selector' },
  { key: 'Space / Insert', label: 'Toggle selection' },
  { key: 'Numpad *', label: 'Invert selection' },
  { key: 'Backspace', label: 'Go up' },
  { key: 'Enter', label: 'Open / Enter directory' },
];
