import { useState, useRef, useEffect } from 'react';
import { X, Plug } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { usePanelStore } from '../../stores/panelStore';
import type { Protocol } from '../../types';

export function QuickConnectDialog() {
  const closeDialog = useUIStore((s) => s.closeDialog);
  const activeSide = usePanelStore((s) => s.activeSide);
  const openRemoteTab = usePanelStore((s) => s.openRemoteTab);

  const [url, setUrl] = useState('');
  const [protocol, setProtocol] = useState<Protocol>('ftp');
  const [host, setHost] = useState('');
  const [port, setPort] = useState(21);
  const [username, setUsername] = useState('anonymous');
  const [password, setPassword] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const parseUrl = (input: string) => {
    setUrl(input);
    try {
      let normalized = input.trim();
      if (!normalized.includes('://')) {
        normalized = `ftp://${normalized}`;
      }
      const parsed = new URL(normalized);
      const proto = parsed.protocol.replace(':', '') as Protocol;
      setProtocol(proto === 'sftp' ? 'sftp' : 'ftp');
      setHost(parsed.hostname);
      setPort(parsed.port ? parseInt(parsed.port) : proto === 'sftp' ? 22 : 21);
      if (parsed.username) setUsername(decodeURIComponent(parsed.username));
      if (parsed.password) setPassword(decodeURIComponent(parsed.password));
    } catch {
      // Not a valid URL yet, user still typing
    }
  };

  const handleConnect = async () => {
    if (!host) return;
    setConnecting(true);
    setError(null);

    try {
      const { saveConnection } = await import('../../services/connections');
      const conn = await saveConnection({
        id: crypto.randomUUID(),
        name: `${host} (Quick)`,
        protocol,
        host,
        port,
        username,
        password,
        remotePath: '/',
        useKeyAuth: false,
        keyPath: '',
        usePassive: true,
        useFtps: false,
      });
      openRemoteTab(activeSide, conn.id, conn.name, '/');
      closeDialog();
    } catch (e) {
      setError(String(e));
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={closeDialog}>
      <div
        className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-xl w-[400px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-3 border-b border-[var(--color-border)]">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Quick Connect</h3>
          <button onClick={closeDialog} className="p-1 hover:bg-[var(--color-bg-hover)] rounded">
            <X size={14} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <label className="block">
            <span className="text-xs text-[var(--color-text-muted)]">URL (or host:port)</span>
            <input
              ref={inputRef}
              value={url}
              onChange={(e) => parseUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConnect();
                if (e.key === 'Escape') closeDialog();
              }}
              placeholder="sftp://user@example.com:22"
              className="mt-0.5 w-full bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-3 py-2 text-xs rounded border border-[var(--color-border)] outline-none focus:border-[var(--color-accent)]"
            />
          </label>

          <div className="grid grid-cols-4 gap-2">
            <label className="block">
              <span className="text-xs text-[var(--color-text-muted)]">Protocol</span>
              <select
                value={protocol}
                onChange={(e) => {
                  const p = e.target.value as Protocol;
                  setProtocol(p);
                  setPort(p === 'sftp' ? 22 : 21);
                }}
                className="mt-0.5 w-full bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-2 py-1.5 text-xs rounded border border-[var(--color-border)]"
              >
                <option value="ftp">FTP</option>
                <option value="sftp">SFTP</option>
              </select>
            </label>
            <label className="block col-span-2">
              <span className="text-xs text-[var(--color-text-muted)]">Host</span>
              <input
                value={host}
                onChange={(e) => setHost(e.target.value)}
                className="mt-0.5 w-full bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-2 py-1.5 text-xs rounded border border-[var(--color-border)] outline-none focus:border-[var(--color-accent)]"
              />
            </label>
            <label className="block">
              <span className="text-xs text-[var(--color-text-muted)]">Port</span>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(parseInt(e.target.value) || 21)}
                className="mt-0.5 w-full bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-2 py-1.5 text-xs rounded border border-[var(--color-border)] outline-none"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-xs text-[var(--color-text-muted)]">Username</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-0.5 w-full bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-2 py-1.5 text-xs rounded border border-[var(--color-border)] outline-none focus:border-[var(--color-accent)]"
              />
            </label>
            <label className="block">
              <span className="text-xs text-[var(--color-text-muted)]">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-0.5 w-full bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-2 py-1.5 text-xs rounded border border-[var(--color-border)] outline-none focus:border-[var(--color-accent)]"
              />
            </label>
          </div>

          {error && (
            <div className="p-2 rounded text-xs bg-red-900/30 text-red-300 border border-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={closeDialog}
              className="px-3 py-1.5 text-xs rounded border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
            >
              Cancel
            </button>
            <button
              onClick={handleConnect}
              disabled={connecting || !host}
              className="px-4 py-1.5 text-xs rounded bg-[var(--color-accent)] text-[var(--color-bg-primary)] hover:bg-[var(--color-accent-hover)] font-semibold disabled:opacity-50 flex items-center gap-1"
            >
              <Plug size={12} />
              {connecting ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
