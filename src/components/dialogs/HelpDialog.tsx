import { X, Keyboard, Info, Globe } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';

export function HelpDialog() {
  const closeDialog = useUIStore((s) => s.closeDialog);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={closeDialog}>
      <div
        className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-xl w-[520px] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-3 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2">
            <Info size={14} className="text-[var(--color-accent)]" />
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              TotalCMD-MP — Help
            </h3>
          </div>
          <button onClick={closeDialog} className="p-1 hover:bg-[var(--color-bg-hover)] rounded">
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs text-[var(--color-text-primary)]">
          <section>
            <h4 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
              <Info size={12} className="text-[var(--color-accent)]" />
              About
            </h4>
            <p className="text-[var(--color-text-muted)] leading-relaxed">
              TotalCMD-MP is a multiplatform dual-panel file manager with FTP/SFTP support,
              inspired by Total Commander. Built with Tauri v2, React, and Rust.
            </p>
            <p className="text-[var(--color-text-muted)] mt-1">Version 0.1.0</p>
          </section>

          <section>
            <h4 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
              <Keyboard size={12} className="text-[var(--color-accent)]" />
              Function Keys
            </h4>
            <div className="space-y-0.5">
              {FUNCTION_KEYS.map((item) => (
                <div key={item.key} className="flex justify-between py-0.5">
                  <kbd className="px-1.5 py-0.5 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded text-[10px] font-mono">
                    {item.key}
                  </kbd>
                  <span className="text-[var(--color-text-muted)]">{item.desc}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h4 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
              <Keyboard size={12} className="text-[var(--color-accent)]" />
              Navigation & Selection
            </h4>
            <div className="space-y-0.5">
              {NAV_KEYS.map((item) => (
                <div key={item.key} className="flex justify-between py-0.5">
                  <kbd className="px-1.5 py-0.5 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded text-[10px] font-mono">
                    {item.key}
                  </kbd>
                  <span className="text-[var(--color-text-muted)]">{item.desc}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h4 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
              <Globe size={12} className="text-[var(--color-accent)]" />
              FTP/SFTP
            </h4>
            <div className="space-y-0.5">
              {FTP_KEYS.map((item) => (
                <div key={item.key} className="flex justify-between py-0.5">
                  <kbd className="px-1.5 py-0.5 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded text-[10px] font-mono">
                    {item.key}
                  </kbd>
                  <span className="text-[var(--color-text-muted)]">{item.desc}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

const FUNCTION_KEYS = [
  { key: 'F1', desc: 'Help (this dialog)' },
  { key: 'F2', desc: 'Refresh current panel' },
  { key: 'F3', desc: 'View file (text + hex)' },
  { key: 'F4', desc: 'Edit file (external editor)' },
  { key: 'F5', desc: 'Copy selected to other panel' },
  { key: 'F6', desc: 'Move selected to other panel' },
  { key: 'Shift+F6', desc: 'Rename file in-place' },
  { key: 'F7', desc: 'Create new directory' },
  { key: 'F8 / Del', desc: 'Delete selected items' },
];

const NAV_KEYS = [
  { key: 'Tab', desc: 'Switch active panel' },
  { key: 'Enter', desc: 'Open directory / file' },
  { key: 'Backspace', desc: 'Go to parent directory' },
  { key: 'Space / Ins', desc: 'Toggle file selection' },
  { key: 'Ctrl+A', desc: 'Select all files' },
  { key: 'Numpad *', desc: 'Invert selection' },
  { key: 'Ctrl+T', desc: 'New tab' },
  { key: 'Ctrl+W', desc: 'Close tab' },
  { key: 'Ctrl+S', desc: 'Quick filter' },
  { key: 'Ctrl+Shift+F', desc: 'Search files' },
  { key: 'Ctrl+L', desc: 'Focus path bar' },
  { key: 'Alt+F1', desc: 'Drive selector (left)' },
  { key: 'Alt+F2', desc: 'Drive selector (right)' },
];

const FTP_KEYS = [
  { key: 'Ctrl+F', desc: 'Connection manager' },
  { key: 'Ctrl+Q', desc: 'Quick connect' },
];
