import { useState, useRef, useEffect } from 'react';
import { X, Plug, ShieldAlert, FileSearch } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { usePanelStore } from '../../stores/panelStore';
import {
  inspectFtpsCertificate,
  connectionTabLabel,
  type CertInfo,
} from '../../services/connections';
import { CertDetails, CERT_ERROR_REGEX } from './CertDetails';
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
  // FTPS on by default; user can opt-out with explicit confirmation.
  const [useFtps, setUseFtps] = useState(true);
  const [confirmPlainFtp, setConfirmPlainFtp] = useState(false);
  const [allowInvalidCerts, setAllowInvalidCerts] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [certInfo, setCertInfo] = useState<CertInfo | null>(null);
  const [inspectingCert, setInspectingCert] = useState(false);
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
      const proto = parsed.protocol.replace(':', '');
      const isSftp = proto === 'sftp';
      const isFtps = proto === 'ftps';
      setProtocol(isSftp ? 'sftp' : 'ftp');
      if (!isSftp && isFtps) {
        setUseFtps(true);
        setConfirmPlainFtp(false);
      }
      setHost(parsed.hostname);
      setPort(parsed.port ? parseInt(parsed.port) : isSftp ? 22 : 21);
      if (parsed.username) setUsername(decodeURIComponent(parsed.username));
      if (parsed.password) setPassword(decodeURIComponent(parsed.password));
    } catch {
      // Not a valid URL yet, user still typing
    }
  };

  const inspectCert = async () => {
    setInspectingCert(true);
    setCertInfo(null);
    try {
      const info = await inspectFtpsCertificate(host, port, port === 990);
      setCertInfo(info);
    } catch (e) {
      setCertInfo(null);
      setError((prev) => `${prev ?? ''}\n\nCert inspect failed: ${e}`);
    } finally {
      setInspectingCert(false);
    }
  };

  const handleConnect = async () => {
    if (!host) return;
    setConnecting(true);
    setError(null);
    setCertInfo(null);

    const connData = {
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
      useFtps: protocol === 'ftp' ? useFtps : false,
      allowInvalidCerts: protocol === 'ftp' && useFtps ? allowInvalidCerts : false,
    };

    try {
      const { saveConnection, testConnection } = await import('../../services/connections');

      // Test first so we can surface FTPS/cert errors in this dialog instead
      // of having them disappear into the panel.
      await testConnection(connData);

      const conn = await saveConnection(connData);
      openRemoteTab(activeSide, conn.id, connectionTabLabel(conn), '/');
      closeDialog();
    } catch (e) {
      const errStr = String(e);
      setError(errStr);
      // Auto-inspect on TLS cert errors so the user can decide
      if (
        protocol === 'ftp' &&
        useFtps &&
        CERT_ERROR_REGEX.test(errStr)
      ) {
        inspectCert();
      }
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

          {protocol === 'ftp' && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs text-[var(--color-text-primary)]">
                <input
                  type="checkbox"
                  checked={useFtps}
                  onChange={(e) => {
                    if (!e.target.checked) {
                      setConfirmPlainFtp(true);
                    } else {
                      setConfirmPlainFtp(false);
                      setUseFtps(true);
                    }
                  }}
                  className="rounded"
                />
                Use FTPS (TLS)
                <span className="ml-1 text-[10px] px-1 rounded bg-green-900/40 text-green-300 border border-green-700/50">
                  recommended
                </span>
              </label>

              {confirmPlainFtp && useFtps && (
                <div className="p-3 rounded border border-red-700 bg-red-950/40 text-red-200 text-xs space-y-2">
                  <div className="flex items-start gap-2">
                    <ShieldAlert size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-red-300">
                        Stai per disattivare la cifratura
                      </div>
                      <p className="mt-1 leading-relaxed">
                        FTP in chiaro invia <strong>username e password senza
                        cifratura</strong>: chiunque sia in ascolto sulla rete può
                        leggerle. Usa FTPS o SFTP quando possibile.
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => setConfirmPlainFtp(false)}
                      className="px-3 py-1 text-xs rounded border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
                    >
                      Annulla, mantieni TLS
                    </button>
                    <button
                      onClick={() => {
                        setUseFtps(false);
                        setConfirmPlainFtp(false);
                      }}
                      className="px-3 py-1 text-xs rounded bg-red-700 text-white hover:bg-red-600 font-semibold"
                    >
                      Disattiva TLS comunque
                    </button>
                  </div>
                </div>
              )}

              {useFtps && (
                <label className="flex items-start gap-2 text-xs text-[var(--color-text-primary)] pl-5">
                  <input
                    type="checkbox"
                    checked={allowInvalidCerts}
                    onChange={(e) => setAllowInvalidCerts(e.target.checked)}
                    className="rounded mt-0.5"
                  />
                  <span>
                    Accetta certificati non validi (self-signed)
                    <span className="block text-[10px] text-[var(--color-text-muted)] leading-tight">
                      Salta la verifica della catena/CN.
                    </span>
                  </span>
                </label>
              )}

              {!useFtps && !confirmPlainFtp && (
                <div className="p-2 rounded border border-red-700/70 bg-red-950/30 text-red-200 text-[11px] flex items-start gap-2">
                  <ShieldAlert size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">FTP in chiaro:</span> password e dati
                    viaggiano non cifrati.
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="p-2 rounded text-xs bg-red-900/30 text-red-300 border border-red-700 space-y-2">
              <div className="whitespace-pre-wrap">{error}</div>

              {protocol === 'ftp' && useFtps && CERT_ERROR_REGEX.test(error) && (
                  <div className="pt-2 border-t border-red-700/40 space-y-2">
                    {inspectingCert && (
                      <div className="text-[11px] text-[var(--color-text-muted)] flex items-center gap-2">
                        <FileSearch size={11} className="animate-pulse" />
                        Recupero dettagli certificato…
                      </div>
                    )}

                    {certInfo && <CertDetails info={certInfo} />}

                    {!allowInvalidCerts && (
                      <div className="flex items-start gap-2">
                        <ShieldAlert size={13} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-yellow-200 text-[11px] leading-relaxed">
                            Verifica i dettagli sopra. Se il fingerprint corrisponde a
                            quello atteso, puoi riprovare accettando il certificato: la
                            connessione resta cifrata ma senza garanzia di identità.
                          </p>
                          <div className="flex gap-2 mt-2">
                            {!certInfo && !inspectingCert && (
                              <button
                                onClick={inspectCert}
                                className="px-3 py-1 text-xs rounded border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] flex items-center gap-1"
                              >
                                <FileSearch size={11} />
                                Mostra dettagli certificato
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setAllowInvalidCerts(true);
                                setError(null);
                                setCertInfo(null);
                                setTimeout(handleConnect, 0);
                              }}
                              className="px-3 py-1 text-xs rounded bg-yellow-700 text-white hover:bg-yellow-600 font-semibold"
                            >
                              Riprova accettando il certificato
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
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
