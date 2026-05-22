import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Plug, TestTube2 } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { usePanelStore } from '../../stores/panelStore';
import { testConnection } from '../../services/connections';
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
    useFtps: false,
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

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  const handleNew = () => {
    setEditing(emptyConnection());
    setIsNew(true);
    setTestResult(null);
  };

  const handleEdit = (conn: Connection) => {
    setEditing({ ...conn });
    setIsNew(false);
    setTestResult(null);
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
    openRemoteTab(activeSide, conn.id, conn.name, conn.remotePath);
    closeDialog();
  };

  const handleTest = async () => {
    if (!editing) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testConnection(editing);
      setTestResult(result);
    } catch (e) {
      setTestResult(`Error: ${e}`);
    } finally {
      setTesting(false);
    }
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
        className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-xl w-[700px] h-[480px] flex"
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
          <div className="flex-1 overflow-y-auto p-1">
            {connections.map((conn) => (
              <div
                key={conn.id}
                className={`flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer text-xs ${
                  editing?.id === conn.id
                    ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]'
                    : 'hover:bg-[var(--color-bg-hover)] text-[var(--color-text-primary)]'
                }`}
                onClick={() => handleEdit(conn)}
                onDoubleClick={() => handleConnect(conn)}
              >
                <span className="flex-1 truncate">{conn.name || conn.host}</span>
                <span className="text-[var(--color-text-muted)] uppercase text-[10px]">
                  {conn.protocol}
                </span>
              </div>
            ))}
            {connections.length === 0 && (
              <p className="text-xs text-[var(--color-text-muted)] p-3 text-center">
                No connections yet. Click + to add one.
              </p>
            )}
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
                  </label>
                  <label className="flex items-center gap-2 text-xs text-[var(--color-text-primary)]">
                    <input
                      type="checkbox"
                      checked={editing.useFtps}
                      onChange={(e) => updateField('useFtps', e.target.checked)}
                      className="rounded"
                    />
                    Use FTPS (TLS)
                  </label>
                </div>
              )}

              {testResult && (
                <div className={`p-2 rounded text-xs ${
                  testResult.startsWith('Error')
                    ? 'bg-red-900/30 text-red-300 border border-red-700'
                    : 'bg-green-900/30 text-green-300 border border-green-700'
                }`}>
                  {testResult}
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
            <div className="flex-1 flex items-center justify-center text-xs text-[var(--color-text-muted)]">
              Select a connection or create a new one
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
