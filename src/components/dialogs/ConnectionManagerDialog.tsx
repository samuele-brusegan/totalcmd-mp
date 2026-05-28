import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Plus, Trash2, Plug, TestTube2, ShieldAlert, FileSearch, Pin, PinOff } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { usePanelStore } from '../../stores/panelStore';
import {
  testConnection,
  inspectFtpsCertificate,
  connectionTabLabel,
  type CertInfo,
} from '../../services/connections';
import { CertDetails, CERT_ERROR_REGEX } from './CertDetails';
import type { Connection, Protocol } from '../../types';

function generateId(): string {
  return crypto.randomUUID();
}

function emptyConnection(): Connection {
  return {
    id: generateId(),
    name: '',
    protocol: 'ftp',
    host: '',
    port: 21,
    username: 'anonymous',
    password: '',
    remotePath: '/',
    useKeyAuth: false,
    keyPath: '',
    usePassive: true,
    // FTPS (FTP over TLS) is on by default for safety; user can opt-out with a warning.
    useFtps: true,
    allowInvalidCerts: false,
  };
}

export function ConnectionManagerDialog() {
  const closeDialog = useUIStore((s) => s.closeDialog);
  const { connections, loadConnections, addConnection, editConnection, removeConnection } =
    useConnectionStore();
  const activeSide = usePanelStore((s) => s.activeSide);
  const openRemoteTab = usePanelStore((s) => s.openRemoteTab);

  const [editing, setEditing] = useState<Connection | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [confirmPlainFtp, setConfirmPlainFtp] = useState(false);
  const [certInfo, setCertInfo] = useState<CertInfo | null>(null);
  const [inspectingCert, setInspectingCert] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<Connection | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  // Focus the list as soon as connections are loaded so the dialog is
  // immediately keyboard-driven (Ctrl+F → arrows → Enter).
  useEffect(() => {
    if (!editing && connections.length > 0) {
      listRef.current?.focus();
      if (selectedIndex >= connections.length) {
        setSelectedIndex(Math.max(0, connections.length - 1));
      }
    }
  }, [connections.length, editing, selectedIndex]);

  // Keep selected row scrolled into view.
  useEffect(() => {
    if (!listRef.current) return;
    const row = listRef.current.querySelector(`[data-cm-index="${selectedIndex}"]`);
    row?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const handleNew = () => {
    setEditing(emptyConnection());
    setIsNew(true);
    setTestResult(null);
  };

  const handleEdit = (conn: Connection) => {
    setEditing({ ...conn });
    setIsNew(false);
    setTestResult(null);
    setConfirmPlainFtp(false);
    setCertInfo(null);
  };

  const inspectCertFor = async (conn: Connection) => {
    if (!conn.host) return;
    setInspectingCert(true);
    setCertInfo(null);
    try {
      const info = await inspectFtpsCertificate(conn.host, conn.port, conn.port === 990);
      setCertInfo(info);
    } catch (e) {
      setCertInfo(null);
      setTestResult((prev) => `${prev ?? ''}\n\nCert inspect failed: ${e}`);
    } finally {
      setInspectingCert(false);
    }
  };

  const handleSave = async () => {
    if (!editing) return;
    if (isNew) {
      await addConnection(editing);
    } else {
      await editConnection(editing);
    }
    setEditing(null);
    setTestResult(null);
  };

  const handleDelete = async (id: string) => {
    await removeConnection(id);
    if (editing?.id === id) {
      setEditing(null);
    }
  };

  const handleConnect = async (conn: Connection) => {
    // Test first so FTPS cert errors surface in this dialog (instead of
    // disappearing into the panel area).
    setTesting(true);
    setTestResult(null);
    setCertInfo(null);
    try {
      await testConnection(conn);
      openRemoteTab(activeSide, conn.id, connectionTabLabel(conn), conn.remotePath);
      closeDialog();
    } catch (e) {
      const errStr = `Error: ${e}`;
      setTestResult(errStr);
      if (conn.protocol === 'ftp' && conn.useFtps && CERT_ERROR_REGEX.test(errStr)) {
        inspectCertFor(conn);
      }
    } finally {
      setTesting(false);
    }
  };

  const handleTest = async () => {
    if (!editing) return;
    setTesting(true);
    setTestResult(null);
    setCertInfo(null);
    try {
      const result = await testConnection(editing);
      setTestResult(result);
    } catch (e) {
      const errStr = `Error: ${e}`;
      setTestResult(errStr);
      if (editing.protocol === 'ftp' && editing.useFtps && CERT_ERROR_REGEX.test(errStr)) {
        inspectCertFor(editing);
      }
    } finally {
      setTesting(false);
    }
  };

  const handleAcceptCertAndRetry = async () => {
    if (!editing) return;
    const updated = { ...editing, allowInvalidCerts: true };
    setEditing(updated);
    if (!isNew) {
      try {
        await editConnection(updated);
      } catch {
        // ignore
      }
    }
    setCertInfo(null);
    setTestResult(null);
    setTesting(true);
    try {
      const result = await testConnection(updated);
      setTestResult(result);
    } catch (e) {
      setTestResult(`Error: ${e}`);
    } finally {
      setTesting(false);
    }
  };

  const handlePinCurrentCert = async () => {
    if (!editing || !certInfo) return;
    // Pin this exact cert; disable the "accept any invalid cert" flag.
    const updated: Connection = {
      ...editing,
      allowInvalidCerts: false,
      pinnedCertSha256: certInfo.fingerprintSha256,
    };
    setEditing(updated);
    if (!isNew) {
      try {
        await editConnection(updated);
      } catch {
        // ignore
      }
    }
    setCertInfo(null);
    setTestResult(null);
    setTesting(true);
    try {
      const result = await testConnection(updated);
      setTestResult(result);
    } catch (e) {
      setTestResult(`Error: ${e}`);
    } finally {
      setTesting(false);
    }
  };

  const handleListKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Don't intercept while a deletion confirm is open
      if (confirmDelete) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, connections.length - 1));
          return;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          return;
        case 'Home':
          e.preventDefault();
          setSelectedIndex(0);
          return;
        case 'End':
          e.preventDefault();
          setSelectedIndex(Math.max(0, connections.length - 1));
          return;
        case 'Enter': {
          e.preventDefault();
          const conn = connections[selectedIndex];
          if (conn) handleConnect(conn);
          return;
        }
        case 'Insert': {
          e.preventDefault();
          handleNew();
          return;
        }
        case 'F4':
        case 'e':
        case 'E': {
          e.preventDefault();
          const conn = connections[selectedIndex];
          if (conn) handleEdit(conn);
          return;
        }
        case 'Delete':
        case 'Backspace': {
          e.preventDefault();
          const conn = connections[selectedIndex];
          if (conn) setConfirmDelete(conn);
          return;
        }
        default:
          // Letter quick-jump: press a printable char to jump to first
          // connection whose name starts with it.
          if (
            e.key.length === 1 &&
            !e.ctrlKey &&
            !e.altKey &&
            !e.metaKey &&
            /[\w]/i.test(e.key)
          ) {
            const ch = e.key.toLowerCase();
            const idx = connections.findIndex((c) =>
              (c.name || c.host).toLowerCase().startsWith(ch)
            );
            if (idx !== -1) {
              e.preventDefault();
              setSelectedIndex(idx);
            }
          }
      }
    },
    // handleConnect, handleEdit, handleNew are inline closures recreated each
    // render; including them would just churn the callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [confirmDelete, connections, selectedIndex]
  );

  const handleUnpinCert = async () => {
    if (!editing) return;
    const updated: Connection = { ...editing, pinnedCertSha256: null };
    setEditing(updated);
    if (!isNew) {
      try {
        await editConnection(updated);
      } catch {
        // ignore
      }
    }
    setTestResult(null);
    setCertInfo(null);
  };

  const updateField = <K extends keyof Connection>(field: K, value: Connection[K]) => {
    if (!editing) return;
    const updated = { ...editing, [field]: value };
    if (field === 'protocol') {
      updated.port = value === 'sftp' ? 22 : 21;
    }
    setEditing(updated);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={closeDialog}>
      <div
        className="relative bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-xl w-[700px] h-[480px] flex"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left: Connection list */}
        <div className="w-[220px] border-r border-[var(--color-border)] flex flex-col">
          <div className="flex items-center justify-between p-3 border-b border-[var(--color-border)]">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Connections</h3>
            <button
              onClick={handleNew}
              className="p-1 hover:bg-[var(--color-bg-hover)] rounded"
              title="New connection"
            >
              <Plus size={14} />
            </button>
          </div>
          <div
            ref={listRef}
            tabIndex={0}
            onKeyDown={handleListKeyDown}
            className="flex-1 overflow-y-auto p-1 outline-none focus:ring-1 focus:ring-[var(--color-accent)]/30 focus:ring-inset"
          >
            {connections.map((conn, i) => {
              const isSelected = i === selectedIndex;
              const isEditing = editing?.id === conn.id;
              return (
                <div
                  key={conn.id}
                  data-cm-index={i}
                  className={`flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer text-xs ${
                    isSelected && !editing
                      ? 'bg-[var(--color-bg-selected)] text-[var(--color-text-primary)]'
                      : isEditing
                      ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]'
                      : 'hover:bg-[var(--color-bg-hover)] text-[var(--color-text-primary)]'
                  }`}
                  onClick={() => {
                    setSelectedIndex(i);
                    listRef.current?.focus();
                  }}
                  onDoubleClick={() => handleConnect(conn)}
                >
                  <span className="flex-1 truncate">{conn.name || conn.host}</span>
                  <span className="text-[var(--color-text-muted)] uppercase text-[10px]">
                    {conn.protocol === 'ftp' && conn.useFtps ? 'ftps' : conn.protocol}
                  </span>
                </div>
              );
            })}
            {connections.length === 0 && (
              <p className="text-xs text-[var(--color-text-muted)] p-3 text-center">
                Nessuna connessione. Premi <kbd>Insert</kbd> per crearne una.
              </p>
            )}
          </div>

          <div className="border-t border-[var(--color-border)] px-2 py-1.5 text-[10px] text-[var(--color-text-muted)] leading-tight">
            <div><kbd>↑↓</kbd> seleziona · <kbd>Enter</kbd> connetti</div>
            <div><kbd>F4/E</kbd> modifica · <kbd>Insert</kbd> nuova · <kbd>Del</kbd> elimina</div>
          </div>
        </div>

        {/* Right: Connection form */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between p-3 border-b border-[var(--color-border)]">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              {editing ? (isNew ? 'New Connection' : 'Edit Connection') : 'Connection Manager'}
            </h3>
            <button onClick={closeDialog} className="p-1 hover:bg-[var(--color-bg-hover)] rounded">
              <X size={14} />
            </button>
          </div>

          {editing ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs text-[var(--color-text-muted)]">Name</span>
                  <input
                    value={editing.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    className="mt-0.5 w-full bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-2 py-1.5 text-xs rounded border border-[var(--color-border)] outline-none focus:border-[var(--color-accent)]"
                    placeholder="My Server"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-[var(--color-text-muted)]">Protocol</span>
                  <select
                    value={editing.protocol}
                    onChange={(e) => updateField('protocol', e.target.value as Protocol)}
                    className="mt-0.5 w-full bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-2 py-1.5 text-xs rounded border border-[var(--color-border)] outline-none focus:border-[var(--color-accent)]"
                  >
                    <option value="ftp">FTP</option>
                    <option value="sftp">SFTP</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <label className="block col-span-2">
                  <span className="text-xs text-[var(--color-text-muted)]">Host</span>
                  <input
                    value={editing.host}
                    onChange={(e) => updateField('host', e.target.value)}
                    className="mt-0.5 w-full bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-2 py-1.5 text-xs rounded border border-[var(--color-border)] outline-none focus:border-[var(--color-accent)]"
                    placeholder="ftp.example.com"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-[var(--color-text-muted)]">Port</span>
                  <input
                    type="number"
                    value={editing.port}
                    onChange={(e) => updateField('port', parseInt(e.target.value) || 21)}
                    className="mt-0.5 w-full bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-2 py-1.5 text-xs rounded border border-[var(--color-border)] outline-none focus:border-[var(--color-accent)]"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs text-[var(--color-text-muted)]">Username</span>
                  <input
                    value={editing.username}
                    onChange={(e) => updateField('username', e.target.value)}
                    className="mt-0.5 w-full bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-2 py-1.5 text-xs rounded border border-[var(--color-border)] outline-none focus:border-[var(--color-accent)]"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-[var(--color-text-muted)]">Password</span>
                  <input
                    type="password"
                    value={editing.password || ''}
                    onChange={(e) => updateField('password', e.target.value)}
                    className="mt-0.5 w-full bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-2 py-1.5 text-xs rounded border border-[var(--color-border)] outline-none focus:border-[var(--color-accent)]"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-xs text-[var(--color-text-muted)]">Remote Path</span>
                <input
                  value={editing.remotePath}
                  onChange={(e) => updateField('remotePath', e.target.value)}
                  className="mt-0.5 w-full bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-2 py-1.5 text-xs rounded border border-[var(--color-border)] outline-none focus:border-[var(--color-accent)]"
                  placeholder="/"
                />
              </label>

              {editing.protocol === 'sftp' && (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs text-[var(--color-text-primary)]">
                    <input
                      type="checkbox"
                      checked={editing.useKeyAuth}
                      onChange={(e) => updateField('useKeyAuth', e.target.checked)}
                      className="rounded"
                    />
                    Use key authentication
                  </label>
                  {editing.useKeyAuth && (
                    <label className="block">
                      <span className="text-xs text-[var(--color-text-muted)]">Key Path</span>
                      <input
                        value={editing.keyPath || ''}
                        onChange={(e) => updateField('keyPath', e.target.value)}
                        className="mt-0.5 w-full bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-2 py-1.5 text-xs rounded border border-[var(--color-border)] outline-none focus:border-[var(--color-accent)]"
                        placeholder="~/.ssh/id_rsa"
                      />
                    </label>
                  )}
                </div>
              )}

              {editing.protocol === 'ftp' && (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs text-[var(--color-text-primary)]">
                    <input
                      type="checkbox"
                      checked={editing.usePassive}
                      onChange={(e) => updateField('usePassive', e.target.checked)}
                      className="rounded"
                    />
                    Passive mode
                    <span className="ml-1 text-[10px] px-1 rounded bg-green-900/40 text-green-300 border border-green-700/50">
                      recommended
                    </span>
                  </label>

                  {!editing.usePassive && (
                    <div className="p-2 rounded border border-yellow-700/70 bg-yellow-950/30 text-yellow-200 text-[11px] flex items-start gap-2">
                      <ShieldAlert size={13} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold">Active mode:</span> il server
                        tenta di aprire una connessione dati verso il tuo PC, che dietro
                        NAT/firewall (Wi-Fi casa, ufficio…) quasi sempre fallisce. La
                        connessione si blocca sui comandi LIST/RETR. Lascia passive
                        attivo se non hai un motivo specifico.
                      </div>
                    </div>
                  )}
                  <label className="flex items-center gap-2 text-xs text-[var(--color-text-primary)]">
                    <input
                      type="checkbox"
                      checked={editing.useFtps}
                      onChange={(e) => {
                        if (!e.target.checked) {
                          // Trying to disable TLS: require explicit confirmation
                          setConfirmPlainFtp(true);
                        } else {
                          setConfirmPlainFtp(false);
                          updateField('useFtps', true);
                        }
                      }}
                      className="rounded"
                    />
                    Use FTPS (TLS)
                    <span className="ml-1 text-[10px] px-1 rounded bg-green-900/40 text-green-300 border border-green-700/50">
                      recommended
                    </span>
                  </label>

                  {editing.useFtps && (
                    <label className="flex items-start gap-2 text-xs text-[var(--color-text-primary)] pl-5">
                      <input
                        type="checkbox"
                        checked={!!editing.allowInvalidCerts}
                        onChange={(e) => updateField('allowInvalidCerts', e.target.checked)}
                        className="rounded mt-0.5"
                      />
                      <span>
                        Accetta certificati non validi (self-signed)
                        <span className="block text-[10px] text-[var(--color-text-muted)] leading-tight">
                          Salta la verifica della catena/CN. Usa solo con server fidati.
                        </span>
                      </span>
                    </label>
                  )}

                  {editing.useFtps && editing.allowInvalidCerts && (
                    <div className="p-2 rounded border border-yellow-700/70 bg-yellow-950/30 text-yellow-200 text-[11px] flex items-start gap-2">
                      <ShieldAlert size={13} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold">Certificato non verificato:</span>{' '}
                        la connessione resta cifrata, ma non è garantita l'identità del
                        server (vulnerabile a MITM se la rete è compromessa).
                      </div>
                    </div>
                  )}

                  {editing.useFtps && editing.pinnedCertSha256 && (
                    <div className="p-2 rounded border border-green-700/60 bg-green-950/30 text-green-200 text-[11px] flex items-start gap-2">
                      <Pin size={13} className="text-green-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold">Certificato pinned</span>
                          <button
                            onClick={handleUnpinCert}
                            className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] flex items-center gap-1"
                            title="Rimuovi il pin"
                          >
                            <PinOff size={10} />
                            rimuovi
                          </button>
                        </div>
                        <div className="font-mono text-[10px] mt-1 break-all">
                          SHA-256: {editing.pinnedCertSha256}
                        </div>
                        <div className="mt-1 leading-snug">
                          Sarà accettato solo questo esatto certificato. Se il server lo
                          rinnova/cambia la connessione fallirà finché non lo riapprovi.
                        </div>
                      </div>
                    </div>
                  )}

                  {confirmPlainFtp && editing.useFtps && (
                    <div className="p-3 rounded border border-red-700 bg-red-950/40 text-red-200 text-xs space-y-2">
                      <div className="flex items-start gap-2">
                        <ShieldAlert size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="font-semibold text-red-300">
                            Stai per disattivare la cifratura
                          </div>
                          <p className="mt-1 leading-relaxed">
                            FTP in chiaro invia <strong>username e password senza alcuna
                            cifratura</strong>: chiunque sia in ascolto sulla rete (Wi-Fi
                            pubblico, ISP, proxy, dispositivi compromessi) può leggerle.
                            Anche i file trasferiti viaggiano in chiaro.
                          </p>
                          <p className="mt-1 leading-relaxed">
                            Usa FTPS o SFTP se il server li supporta. Procedi solo se sai
                            esattamente cosa stai facendo (es. server locale di sviluppo).
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
                            updateField('useFtps', false);
                            setConfirmPlainFtp(false);
                          }}
                          className="px-3 py-1 text-xs rounded bg-red-700 text-white hover:bg-red-600 font-semibold"
                        >
                          Disattiva TLS comunque
                        </button>
                      </div>
                    </div>
                  )}

                  {!editing.useFtps && !confirmPlainFtp && (
                    <div className="p-2 rounded border border-red-700/70 bg-red-950/30 text-red-200 text-[11px] flex items-start gap-2">
                      <ShieldAlert size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold">FTP in chiaro:</span> password e
                        dati viaggiano non cifrati. Riattiva FTPS appena possibile.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {testResult && (
                <div
                  className={`p-2 rounded text-xs space-y-2 ${
                    testResult.startsWith('Error')
                      ? 'bg-red-900/30 text-red-300 border border-red-700'
                      : 'bg-green-900/30 text-green-300 border border-green-700'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{testResult}</div>

                  {editing.protocol === 'ftp' &&
                    editing.useFtps &&
                    CERT_ERROR_REGEX.test(testResult) && (
                      <div className="pt-2 border-t border-red-700/40 space-y-2">
                        {inspectingCert && (
                          <div className="text-[11px] text-[var(--color-text-muted)] flex items-center gap-2">
                            <FileSearch size={11} className="animate-pulse" />
                            Recupero dettagli certificato…
                          </div>
                        )}

                        {certInfo && <CertDetails info={certInfo} />}

                        {!editing.allowInvalidCerts && (
                          <div className="flex items-start gap-2">
                            <ShieldAlert
                              size={13}
                              className="text-yellow-400 flex-shrink-0 mt-0.5"
                            />
                            <div className="flex-1">
                              <p className="text-yellow-200 text-[11px] leading-relaxed">
                                Verifica i dettagli sopra. Se il fingerprint corrisponde
                                a quello atteso, puoi accettare il certificato:
                                la connessione resta cifrata ma senza garanzia di
                                identità.
                              </p>
                              <div className="flex gap-2 mt-2">
                                {!certInfo && !inspectingCert && (
                                  <button
                                    onClick={() => inspectCertFor(editing)}
                                    className="px-3 py-1 text-xs rounded border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] flex items-center gap-1"
                                  >
                                    <FileSearch size={11} />
                                    Mostra dettagli certificato
                                  </button>
                                )}
                                <button
                                  onClick={handlePinCurrentCert}
                                  disabled={testing || !certInfo}
                                  title={
                                    certInfo
                                      ? 'Salva il fingerprint: solo questo cert sarà accettato'
                                      : 'Carica prima i dettagli del certificato'
                                  }
                                  className="px-3 py-1 text-xs rounded bg-green-700 text-white hover:bg-green-600 font-semibold disabled:opacity-50 flex items-center gap-1"
                                >
                                  <Pin size={11} />
                                  Accetta solo questo certificato
                                </button>
                                <button
                                  onClick={handleAcceptCertAndRetry}
                                  disabled={testing}
                                  title="Accetta qualsiasi certificato non valido (meno sicuro)"
                                  className="px-3 py-1 text-xs rounded bg-yellow-700 text-white hover:bg-yellow-600 font-semibold disabled:opacity-50"
                                >
                                  Accetta qualsiasi certificato
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleTest}
                  disabled={testing || !editing.host}
                  className="px-3 py-1.5 text-xs rounded border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] disabled:opacity-50 flex items-center gap-1"
                >
                  <TestTube2 size={12} />
                  {testing ? 'Testing...' : 'Test'}
                </button>
                <button
                  onClick={handleSave}
                  disabled={!editing.name || !editing.host}
                  className="px-3 py-1.5 text-xs rounded bg-[var(--color-accent)] text-[var(--color-bg-primary)] hover:bg-[var(--color-accent-hover)] font-semibold disabled:opacity-50"
                >
                  {isNew ? 'Save' : 'Update'}
                </button>
                <button
                  onClick={() => handleConnect(editing)}
                  disabled={!editing.host}
                  className="px-3 py-1.5 text-xs rounded bg-green-600 text-white hover:bg-green-500 font-semibold disabled:opacity-50 flex items-center gap-1"
                >
                  <Plug size={12} />
                  Connect
                </button>
                {!isNew && (
                  <button
                    onClick={() => handleDelete(editing.id)}
                    className="px-3 py-1.5 text-xs rounded border border-red-700 text-red-400 hover:bg-red-900/30 flex items-center gap-1 ml-auto"
                  >
                    <Trash2 size={12} />
                    Delete
                  </button>
                )}
              </div>
            </div>
          ) : (
            <ConnectionSummary
              conn={connections[selectedIndex]}
              connecting={testing}
              onConnect={handleConnect}
              onEdit={handleEdit}
              onDelete={(c) => setConfirmDelete(c)}
              onNew={handleNew}
              testResult={testResult}
            />
          )}
        </div>

        {confirmDelete && (
          <div
            className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg shadow-xl p-4 w-[340px] space-y-3">
              <div className="flex items-start gap-2 text-xs text-[var(--color-text-primary)]">
                <Trash2 size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  Eliminare la connessione{' '}
                  <span className="font-semibold">
                    {confirmDelete.name || confirmDelete.host}
                  </span>
                  ?
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="px-3 py-1 text-xs rounded border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)]"
                  autoFocus
                >
                  Annulla
                </button>
                <button
                  onClick={async () => {
                    await removeConnection(confirmDelete.id);
                    if (editing?.id === confirmDelete.id) setEditing(null);
                    setSelectedIndex((i) =>
                      Math.max(0, Math.min(i, connections.length - 2))
                    );
                    setConfirmDelete(null);
                  }}
                  className="px-3 py-1 text-xs rounded bg-red-700 text-white hover:bg-red-600 font-semibold"
                >
                  Elimina
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ConnectionSummary({
  conn,
  connecting,
  onConnect,
  onEdit,
  onDelete,
  onNew,
  testResult,
}: {
  conn: Connection | undefined;
  connecting: boolean;
  onConnect: (c: Connection) => void;
  onEdit: (c: Connection) => void;
  onDelete: (c: Connection) => void;
  onNew: () => void;
  testResult: string | null;
}) {
  if (!conn) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-xs text-[var(--color-text-muted)] gap-3 p-8 text-center">
        <p>Nessuna connessione salvata.</p>
        <button
          onClick={onNew}
          className="px-3 py-1.5 text-xs rounded bg-[var(--color-accent)] text-[var(--color-bg-primary)] font-semibold hover:bg-[var(--color-accent-hover)]"
        >
          Crea la prima (Insert)
        </button>
      </div>
    );
  }
  const proto =
    conn.protocol === 'sftp' ? 'SFTP' : conn.useFtps ? 'FTPS' : 'FTP';
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
      <div className="space-y-1">
        <div className="text-base font-semibold text-[var(--color-text-primary)]">
          {conn.name || conn.host}
        </div>
        <div className="text-[var(--color-text-muted)] font-mono">
          {proto.toLowerCase()}://{conn.username}@{conn.host}:{conn.port}
          {conn.remotePath}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-2 text-[var(--color-text-secondary)]">
        <Field label="Protocol" value={proto} />
        <Field label="Host" value={conn.host} />
        <Field label="Port" value={String(conn.port)} />
        <Field label="Username" value={conn.username} />
        <Field label="Remote path" value={conn.remotePath} />
        {conn.protocol === 'ftp' && (
          <Field label="Passive" value={conn.usePassive ? 'on' : 'off'} />
        )}
        {conn.protocol === 'sftp' && conn.useKeyAuth && (
          <Field label="Key" value={conn.keyPath || '(default)'} />
        )}
        {conn.pinnedCertSha256 && (
          <Field
            label="Cert pin"
            value={conn.pinnedCertSha256.slice(0, 23) + '…'}
          />
        )}
        {conn.allowInvalidCerts && (
          <Field label="TLS" value="invalid certs accepted" />
        )}
      </div>

      {testResult && (
        <div
          className={`p-2 rounded text-[11px] ${
            testResult.startsWith('Error')
              ? 'bg-red-900/30 text-red-300 border border-red-700'
              : 'bg-green-900/30 text-green-300 border border-green-700'
          }`}
        >
          {testResult}
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-2">
        <button
          onClick={() => onConnect(conn)}
          disabled={connecting}
          className="px-3 py-1.5 text-xs rounded bg-green-600 text-white hover:bg-green-500 font-semibold disabled:opacity-50 flex items-center gap-1"
        >
          <Plug size={12} />
          {connecting ? 'Connecting…' : 'Connetti (Enter)'}
        </button>
        <button
          onClick={() => onEdit(conn)}
          className="px-3 py-1.5 text-xs rounded border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)]"
        >
          Modifica (F4)
        </button>
        <button
          onClick={onNew}
          className="px-3 py-1.5 text-xs rounded border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] flex items-center gap-1"
        >
          <Plus size={11} />
          Nuova (Insert)
        </button>
        <button
          onClick={() => onDelete(conn)}
          className="px-3 py-1.5 text-xs rounded border border-red-700 text-red-400 hover:bg-red-900/30 ml-auto flex items-center gap-1"
        >
          <Trash2 size={11} />
          Elimina (Del)
        </button>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-[var(--color-text-muted)] w-24 flex-shrink-0">
        {label}
      </span>
      <span className="flex-1 truncate" title={value}>
        {value}
      </span>
    </div>
  );
}
