import { create } from 'zustand';
import {
  gitIsRepo,
  gitStatus,
  gitLog,
  gitBranches,
  type GitRepoInfo,
  type GitFileStatus,
  type GitCommit,
  type GitBranch,
} from '../services/git';

interface GitStore {
  panelOpen: boolean;
  cwd: string | null;
  repoRoot: string | null;
  info: GitRepoInfo | null;
  files: GitFileStatus[];
  commits: GitCommit[];
  branches: GitBranch[];
  loading: boolean;
  error: string | null;

  togglePanel: () => void;
  setCwd: (path: string | null) => Promise<void>;
  refresh: () => Promise<void>;
}

export const useGitStore = create<GitStore>((set, get) => ({
  panelOpen: false,
  cwd: null,
  repoRoot: null,
  info: null,
  files: [],
  commits: [],
  branches: [],
  loading: false,
  error: null,

  togglePanel: () => {
    const next = !get().panelOpen;
    set({ panelOpen: next });
    if (next) {
      get().refresh();
    }
  },

  setCwd: async (path) => {
    if (path === get().cwd) return;
    set({ cwd: path, error: null });
    if (!path) {
      set({ repoRoot: null, info: null, files: [], commits: [], branches: [] });
      return;
    }
    try {
      const root = await gitIsRepo(path);
      set({ repoRoot: root });
      if (root && get().panelOpen) {
        await get().refresh();
      } else if (!root) {
        set({ info: null, files: [], commits: [], branches: [] });
      }
    } catch (e) {
      set({ error: String(e), repoRoot: null });
    }
  },

  refresh: async () => {
    const { cwd } = get();
    if (!cwd) return;
    set({ loading: true, error: null });
    try {
      const root = await gitIsRepo(cwd);
      if (!root) {
        set({
          repoRoot: null,
          info: null,
          files: [],
          commits: [],
          branches: [],
          loading: false,
        });
        return;
      }
      const [statusRes, commits, branches] = await Promise.all([
        gitStatus(cwd),
        gitLog(cwd, 100).catch(() => []),
        gitBranches(cwd).catch(() => []),
      ]);
      set({
        repoRoot: root,
        info: statusRes.info,
        files: statusRes.files,
        commits,
        branches,
        loading: false,
      });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },
}));
