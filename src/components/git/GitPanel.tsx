import { useEffect, useMemo, useState } from 'react';
import {
  GitBranch as GitBranchIcon,
  RefreshCw,
  Download,
  Upload,
  ArrowDownToLine,
  Plus,
  Minus,
  X,
  Check,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { useGitStore } from '../../stores/gitStore';
import {
  gitStage,
  gitUnstage,
  gitCommit,
  gitFetch,
  gitPull,
  gitPush,
  gitDiff,
  gitCheckout,
  type GitFileStatus,
  type GitCommit,
} from '../../services/git';

function statusBadge(s: GitFileStatus): { label: string; cls: string } {
  if (s.conflicted) return { label: 'C', cls: 'text-red-400' };
  const idx = s.indexStatus;
  const wt = s.wtStatus;
  if (idx !== 'none' && wt !== 'none')
    return { label: idx[0].toUpperCase() + wt[0].toUpperCase(), cls: 'text-yellow-300' };
  if (idx !== 'none') {
    if (idx === 'new') return { label: 'A', cls: 'text-green-400' };
    if (idx === 'deleted') return { label: 'D', cls: 'text-red-400' };
    if (idx === 'modified') return { label: 'M', cls: 'text-yellow-300' };
    if (idx === 'renamed') return { label: 'R', cls: 'text-blue-400' };
    return { label: idx[0].toUpperCase(), cls: 'text-yellow-300' };
  }
  if (wt === 'new') return { label: '?', cls: 'text-[var(--color-text-muted)]' };
  if (wt === 'deleted') return { label: 'D', cls: 'text-red-400' };
  if (wt === 'modified') return { label: 'M', cls: 'text-yellow-300' };
  if (wt === 'renamed') return { label: 'R', cls: 'text-blue-400' };
  return { label: wt[0].toUpperCase(), cls: 'text-[var(--color-text-muted)]' };
}

function FileRow({
  file,
  staged,
  onToggle,
  onSelect,
  selected,
}: {
  file: GitFileStatus;
  staged: boolean;
  onToggle: () => void;
  onSelect: () => void;
  selected: boolean;
}) {
  const badge = statusBadge(file);
  return (
    <div
      onClick={onSelect}
      className={`flex items-center gap-2 px-2 py-0.5 text-xs cursor-pointer ${
        selected ? 'bg-[var(--color-bg-selected)]' : 'hover:bg-[var(--color-bg-hover)]'
      }`}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className="p-0.5 rounded hover:bg-[var(--color-bg-active)]"
        title={staged ? 'Unstage' : 'Stage'}
      >
        {staged ? <Minus size={11} /> : <Plus size={11} />}
      </button>
      <span className={`w-6 text-center font-bold ${badge.cls}`}>{badge.label}</span>
      <span className="flex-1 truncate text-[var(--color-text-primary)]">{file.path}</span>
    </div>
  );
}

function CommitGraph({ commits }: { commits: GitCommit[] }) {
  // Simple lane-based graph
  const rows = useMemo(() => {
    type Lane = string | null; // commit id occupying lane
    const lanes: Lane[] = [];
    return commits.map((c) => {
      let lane = lanes.indexOf(c.id);
      if (lane === -1) {
        lane = lanes.findIndex((l) => l === null);
        if (lane === -1) {
          lane = lanes.length;
          lanes.push(null);
        }
      }
      // After drawing this commit, replace its lane with first parent (continue line),
      // and any extra parents go to new lanes.
      lanes[lane] = c.parents[0] ?? null;
      for (let i = 1; i < c.parents.length; i++) {
        const free = lanes.findIndex((l) => l === null);
        if (free === -1) lanes.push(c.parents[i]);
        else lanes[free] = c.parents[i];
      }
      return { commit: c, lane, totalLanes: lanes.length };
    });
  }, [commits]);

  const COLORS = [
    '#89b4fa',
    '#a6e3a1',
    '#f9e2af',
    '#f38ba8',
    '#cba6f7',
    '#94e2d5',
    '#fab387',
  ];

  return (
    <div className="flex-1 overflow-y-auto text-xs font-mono">
      {rows.map(({ commit, lane, totalLanes }) => (
        <div
          key={commit.id}
          className="flex items-center gap-2 px-2 py-0.5 hover:bg-[var(--color-bg-hover)]"
        >
          <div
            className="relative flex-shrink-0"
            style={{ width: Math.max(totalLanes, 1) * 10 }}
          >
            <div
              className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
              style={{
                left: lane * 10,
                backgroundColor: COLORS[lane % COLORS.length],
              }}
            />
          </div>
          <span className="text-[var(--color-text-muted)] w-14 truncate">{commit.shortId}</span>
          <span className="flex-1 truncate text-[var(--color-text-primary)]">
            {commit.summary}
          </span>
          <span className="text-[var(--color-text-muted)] truncate w-32">{commit.author}</span>
        </div>
      ))}
      {commits.length === 0 && (
        <div className="p-4 text-center text-[var(--color-text-muted)]">No commits</div>
      )}
    </div>
  );
}

type Tab = 'changes' | 'graph' | 'diff';

export function GitPanel() {
  const panelOpen = useGitStore((s) => s.panelOpen);
  const togglePanel = useGitStore((s) => s.togglePanel);
  const refresh = useGitStore((s) => s.refresh);
  const info = useGitStore((s) => s.info);
  const files = useGitStore((s) => s.files);
  const commits = useGitStore((s) => s.commits);
  const branches = useGitStore((s) => s.branches);
  const cwd = useGitStore((s) => s.cwd);
  const repoRoot = useGitStore((s) => s.repoRoot);
  const loading = useGitStore((s) => s.loading);
  const error = useGitStore((s) => s.error);

  const [tab, setTab] = useState<Tab>('changes');
  const [commitMsg, setCommitMsg] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [opMsg, setOpMsg] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [diffText, setDiffText] = useState<string>('');
  const [diffStaged, setDiffStaged] = useState(false);
  const [showBranches, setShowBranches] = useState(false);

  const staged = useMemo(() => files.filter((f) => f.staged), [files]);
  const unstaged = useMemo(() => files.filter((f) => !f.staged && !f.ignored), [files]);

  useEffect(() => {
    if (!panelOpen || !selectedFile || !repoRoot) return;
    gitDiff(repoRoot, selectedFile, diffStaged)
      .then(setDiffText)
      .catch((e) => setDiffText(String(e)));
  }, [selectedFile, diffStaged, repoRoot, panelOpen]);

  if (!panelOpen) return null;

  const runOp = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    setOpMsg(null);
    try {
      const res = await fn();
      setOpMsg(typeof res === 'string' ? `${label}: ${res}` : `${label}: ok`);
      await refresh();
    } catch (e) {
      setOpMsg(`${label}: ${e}`);
    } finally {
      setBusy(null);
    }
  };

  const onToggleStage = async (f: GitFileStatus) => {
    if (!repoRoot) return;
    if (f.staged) {
      await gitUnstage(repoRoot, [f.path]);
    } else {
      await gitStage(repoRoot, [f.path]);
    }
    await refresh();
  };

  const stageAll = async () => {
    if (!repoRoot || unstaged.length === 0) return;
    await gitStage(
      repoRoot,
      unstaged.map((f) => f.path)
    );
    await refresh();
  };

  const unstageAll = async () => {
    if (!repoRoot || staged.length === 0) return;
    await gitUnstage(
      repoRoot,
      staged.map((f) => f.path)
    );
    await refresh();
  };

  const onCommit = async () => {
    if (!repoRoot || !commitMsg.trim()) return;
    await runOp('commit', () => gitCommit(repoRoot, commitMsg.trim()));
    setCommitMsg('');
  };

  const onCheckout = async (name: string) => {
    if (!repoRoot) return;
    setShowBranches(false);
    await runOp('checkout', () => gitCheckout(repoRoot, name));
  };

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-secondary)] border-t border-[var(--color-border)]">
      {/* Header */}
      <div className="flex items-center gap-2 px-2 h-7 border-b border-[var(--color-border)] text-xs">
        <GitBranchIcon size={12} className="text-[var(--color-accent)]" />
        {repoRoot ? (
          <>
            <button
              onClick={() => setShowBranches((v) => !v)}
              className="font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] px-1 rounded relative"
            >
              {info?.branch ?? '(detached)'}
              {showBranches && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded shadow-lg max-h-72 overflow-y-auto min-w-[220px] text-left">
                  {branches.map((b) => (
                    <button
                      key={`${b.isRemote ? 'r' : 'l'}:${b.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onCheckout(b.name);
                      }}
                      className={`flex items-center gap-2 w-full px-2 py-1 hover:bg-[var(--color-bg-hover)] ${
                        b.isHead ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'
                      }`}
                    >
                      {b.isHead ? <Check size={11} /> : <span className="w-[11px]" />}
                      <span className="flex-1 truncate">
                        {b.isRemote ? `(remote) ${b.name}` : b.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </button>
            {info && (info.ahead > 0 || info.behind > 0) && (
              <span className="text-[var(--color-text-muted)]">
                {info.ahead > 0 && <>↑{info.ahead}</>} {info.behind > 0 && <>↓{info.behind}</>}
              </span>
            )}
            {info?.upstream && (
              <span className="text-[var(--color-text-muted)] truncate">→ {info.upstream}</span>
            )}
          </>
        ) : (
          <span className="text-[var(--color-text-muted)]">
            {cwd ? 'Not a git repository' : 'No directory selected'}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {repoRoot && (
            <>
              <button
                disabled={!!busy}
                onClick={() => runOp('fetch', () => gitFetch(repoRoot))}
                className="p-1 hover:bg-[var(--color-bg-hover)] rounded disabled:opacity-50"
                title="Fetch"
              >
                <ArrowDownToLine size={12} />
              </button>
              <button
                disabled={!!busy}
                onClick={() => runOp('pull', () => gitPull(repoRoot))}
                className="p-1 hover:bg-[var(--color-bg-hover)] rounded disabled:opacity-50"
                title="Pull"
              >
                <Download size={12} />
              </button>
              <button
                disabled={!!busy}
                onClick={() => runOp('push', () => gitPush(repoRoot))}
                className="p-1 hover:bg-[var(--color-bg-hover)] rounded disabled:opacity-50"
                title="Push"
              >
                <Upload size={12} />
              </button>
              <button
                onClick={() => refresh()}
                className="p-1 hover:bg-[var(--color-bg-hover)] rounded"
                title="Refresh"
              >
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              </button>
            </>
          )}
          <button
            onClick={togglePanel}
            className="p-1 hover:bg-[var(--color-bg-hover)] rounded"
            title="Close"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Op message / errors */}
      {(opMsg || error) && (
        <div className="px-2 py-1 text-[10px] flex items-center gap-1 border-b border-[var(--color-border)] bg-[var(--color-bg-tertiary)]">
          <AlertTriangle size={10} className="text-yellow-400 flex-shrink-0" />
          <span className="truncate text-[var(--color-text-secondary)]">{error || opMsg}</span>
        </div>
      )}

      {/* Tabs */}
      {repoRoot && (
        <>
          <div className="flex border-b border-[var(--color-border)] text-xs">
            {(['changes', 'graph', 'diff'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1 ${
                  tab === t
                    ? 'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] border-b-2 border-[var(--color-accent)] -mb-px'
                    : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)]'
                }`}
              >
                {t === 'changes'
                  ? `Changes (${files.length})`
                  : t === 'graph'
                  ? `Graph (${commits.length})`
                  : 'Diff'}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 flex">
            {tab === 'changes' && (
              <div className="flex-1 flex flex-col">
                <div className="flex-1 overflow-y-auto">
                  {staged.length > 0 && (
                    <div>
                      <div className="px-2 py-0.5 text-[10px] uppercase text-[var(--color-text-muted)] flex items-center justify-between bg-[var(--color-bg-tertiary)]">
                        <span>Staged ({staged.length})</span>
                        <button onClick={unstageAll} className="hover:underline">
                          unstage all
                        </button>
                      </div>
                      {staged.map((f) => (
                        <FileRow
                          key={`s:${f.path}`}
                          file={f}
                          staged
                          onToggle={() => onToggleStage(f)}
                          onSelect={() => {
                            setSelectedFile(f.path);
                            setDiffStaged(true);
                            setTab('diff');
                          }}
                          selected={selectedFile === f.path && diffStaged}
                        />
                      ))}
                    </div>
                  )}
                  {unstaged.length > 0 && (
                    <div>
                      <div className="px-2 py-0.5 text-[10px] uppercase text-[var(--color-text-muted)] flex items-center justify-between bg-[var(--color-bg-tertiary)]">
                        <span>Changes ({unstaged.length})</span>
                        <button onClick={stageAll} className="hover:underline">
                          stage all
                        </button>
                      </div>
                      {unstaged.map((f) => (
                        <FileRow
                          key={`u:${f.path}`}
                          file={f}
                          staged={false}
                          onToggle={() => onToggleStage(f)}
                          onSelect={() => {
                            setSelectedFile(f.path);
                            setDiffStaged(false);
                            setTab('diff');
                          }}
                          selected={selectedFile === f.path && !diffStaged}
                        />
                      ))}
                    </div>
                  )}
                  {files.length === 0 && (
                    <div className="p-4 text-center text-[var(--color-text-muted)] text-xs">
                      Working tree clean
                    </div>
                  )}
                </div>

                {/* Commit input */}
                <div className="border-t border-[var(--color-border)] p-2 flex flex-col gap-1">
                  <textarea
                    value={commitMsg}
                    onChange={(e) => setCommitMsg(e.target.value)}
                    placeholder="Commit message…"
                    rows={2}
                    className="w-full bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] text-xs px-2 py-1 rounded border border-[var(--color-border)] outline-none focus:border-[var(--color-accent)] resize-none"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-[var(--color-text-muted)]">
                      {staged.length} staged
                    </span>
                    <button
                      onClick={onCommit}
                      disabled={!commitMsg.trim() || staged.length === 0 || !!busy}
                      className="px-3 py-1 text-xs rounded bg-[var(--color-accent)] text-[var(--color-bg-primary)] font-semibold hover:bg-[var(--color-accent-hover)] disabled:opacity-40"
                    >
                      Commit
                    </button>
                  </div>
                </div>
              </div>
            )}

            {tab === 'graph' && <CommitGraph commits={commits} />}

            {tab === 'diff' && (
              <div className="flex-1 overflow-auto bg-[var(--color-bg-primary)]">
                {selectedFile ? (
                  <>
                    <div className="px-2 py-1 text-xs text-[var(--color-text-muted)] border-b border-[var(--color-border)] flex items-center gap-2">
                      <FileText size={11} />
                      <span className="truncate">{selectedFile}</span>
                      <span className="ml-auto">{diffStaged ? 'staged' : 'unstaged'}</span>
                    </div>
                    <pre className="text-[11px] font-mono p-2 whitespace-pre">
                      {diffText.split('\n').map((line, i) => {
                        let cls = 'text-[var(--color-text-primary)]';
                        if (line.startsWith('+')) cls = 'text-green-400';
                        else if (line.startsWith('-')) cls = 'text-red-400';
                        else if (line.startsWith('@')) cls = 'text-[var(--color-accent)]';
                        else if (line.startsWith('diff') || line.startsWith('index'))
                          cls = 'text-[var(--color-text-muted)]';
                        return (
                          <div key={i} className={cls}>
                            {line || '\u00A0'}
                          </div>
                        );
                      })}
                    </pre>
                  </>
                ) : (
                  <div className="p-4 text-xs text-[var(--color-text-muted)]">
                    Select a file from Changes to view its diff
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
