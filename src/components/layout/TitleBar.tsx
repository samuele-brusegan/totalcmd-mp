import { useEffect, useState } from 'react';
import { Minus, Square, Copy, X } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

type ButtonId = 'minimize' | 'maximize' | 'close';

interface ButtonLayout {
  left: ButtonId[];
  right: ButtonId[];
  style: 'macos' | 'windows' | 'gnome' | 'default';
}

const FALLBACK_LAYOUT: ButtonLayout = {
  left: [],
  right: ['minimize', 'maximize', 'close'],
  style: 'default',
};

export function TitleBar() {
  const [maximized, setMaximized] = useState(false);
  const [layout, setLayout] = useState<ButtonLayout>(FALLBACK_LAYOUT);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const win = getCurrentWindow();
        setMaximized(await win.isMaximized());
        unlisten = await win.onResized(async () => {
          setMaximized(await win.isMaximized());
        });
      } catch {
        // Non-Tauri context
      }
    })();
    return () => {
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    invoke<ButtonLayout>('get_window_button_layout')
      .then((l) => setLayout(l))
      .catch(() => setLayout(FALLBACK_LAYOUT));
  }, []);

  const withWindow = async (
    fn: (
      win: Awaited<ReturnType<typeof import('@tauri-apps/api/window').getCurrentWindow>>
    ) => Promise<void> | void
  ) => {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await fn(getCurrentWindow());
    } catch {
      /* ignore */
    }
  };

  const buttons: Record<ButtonId, React.ReactNode> = {
    minimize:
      layout.style === 'macos' ? (
        <TrafficLight key="minimize" color="yellow" onClick={() => withWindow((w) => w.minimize())} title="Minimize" />
      ) : (
        <button
          key="minimize"
          aria-label="Minimize"
          onClick={() => withWindow((w) => w.minimize())}
          className="px-3 hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] h-full flex items-center"
        >
          <Minus size={12} />
        </button>
      ),
    maximize:
      layout.style === 'macos' ? (
        <TrafficLight
          key="maximize"
          color="green"
          onClick={() => withWindow((w) => w.toggleMaximize())}
          title={maximized ? 'Restore' : 'Maximize'}
        />
      ) : (
        <button
          key="maximize"
          aria-label={maximized ? 'Restore' : 'Maximize'}
          onClick={() => withWindow((w) => w.toggleMaximize())}
          className="px-3 hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] h-full flex items-center"
        >
          {maximized ? <Copy size={11} /> : <Square size={11} />}
        </button>
      ),
    close:
      layout.style === 'macos' ? (
        <TrafficLight
          key="close"
          color="red"
          onClick={() => withWindow((w) => w.close())}
          title="Close"
        />
      ) : (
        <button
          key="close"
          aria-label="Close"
          onClick={() => withWindow((w) => w.close())}
          className="px-3 hover:bg-red-600 hover:text-white text-[var(--color-text-secondary)] h-full flex items-center"
        >
          <X size={12} />
        </button>
      ),
  };

  const isMac = layout.style === 'macos';

  return (
    <div
      data-tauri-drag-region
      className="flex items-center h-7 bg-[var(--color-bg-tertiary)] border-b border-[var(--color-border)] select-none"
    >
      {layout.left.length > 0 && (
        <div className={`flex items-center h-full ${isMac ? 'px-2 gap-1.5' : ''}`}>
          {layout.left.map((id) => buttons[id])}
        </div>
      )}
      <div
        data-tauri-drag-region
        className={`flex-1 px-3 text-xs text-[var(--color-text-muted)] truncate ${
          isMac ? 'text-center' : ''
        }`}
      >
        TotalCMD-MP
      </div>
      {layout.right.length > 0 && (
        <div className={`flex items-stretch h-full ${isMac ? 'px-2 gap-1.5' : ''}`}>
          {layout.right.map((id) => buttons[id])}
        </div>
      )}
    </div>
  );
}

function TrafficLight({
  color,
  onClick,
  title,
}: {
  color: 'red' | 'yellow' | 'green';
  onClick: () => void;
  title: string;
}) {
  const bg =
    color === 'red'
      ? 'bg-[#ff5f57] hover:bg-[#ff3b30]'
      : color === 'yellow'
      ? 'bg-[#ffbd2e] hover:bg-[#ffaa00]'
      : 'bg-[#28c940] hover:bg-[#1faf30]';
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-3 h-3 rounded-full ${bg} self-center transition-colors`}
    />
  );
}
