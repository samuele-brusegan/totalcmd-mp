import { invoke } from '@tauri-apps/api/core';

export interface GitRepoInfo {
  root: string;
  branch: string | null;
  head: string | null;
  upstream: string | null;
  ahead: number;
  behind: number;
  clean: boolean;
}

export type GitFileChangeType =
  | 'new'
  | 'modified'
  | 'deleted'
  | 'renamed'
  | 'typechange'
  | 'none';

export interface GitFileStatus {
  path: string;
  indexStatus: GitFileChangeType;
  wtStatus: GitFileChangeType;
  staged: boolean;
  conflicted: boolean;
  ignored: boolean;
}

export interface GitStatusResult {
  info: GitRepoInfo;
  files: GitFileStatus[];
}

export interface GitCommit {
  id: string;
  shortId: string;
  summary: string;
  author: string;
  email: string;
  time: number;
  parents: string[];
}

export interface GitBranch {
  name: string;
  isRemote: boolean;
  isHead: boolean;
  upstream: string | null;
}

// Backend uses snake_case in struct fields via serde defaults? Actually we used `index_status`.
// Tauri serde default is to keep field names as-is. Convert here.
interface RawFileStatus {
  path: string;
  index_status: GitFileChangeType;
  wt_status: GitFileChangeType;
  staged: boolean;
  conflicted: boolean;
  ignored: boolean;
}

interface RawStatusResult {
  info: GitRepoInfo;
  files: RawFileStatus[];
}

interface RawCommit {
  id: string;
  short_id: string;
  summary: string;
  author: string;
  email: string;
  time: number;
  parents: string[];
}

interface RawBranch {
  name: string;
  is_remote: boolean;
  is_head: boolean;
  upstream: string | null;
}

export async function gitIsRepo(path: string): Promise<string | null> {
  return (await invoke<string | null>('git_is_repo', { path })) ?? null;
}

export async function gitStatus(path: string): Promise<GitStatusResult> {
  const raw = await invoke<RawStatusResult>('git_status', { path });
  return {
    info: raw.info,
    files: raw.files.map((f) => ({
      path: f.path,
      indexStatus: f.index_status,
      wtStatus: f.wt_status,
      staged: f.staged,
      conflicted: f.conflicted,
      ignored: f.ignored,
    })),
  };
}

export async function gitLog(path: string, limit = 200): Promise<GitCommit[]> {
  const raw = await invoke<RawCommit[]>('git_log', { path, limit });
  return raw.map((c) => ({
    id: c.id,
    shortId: c.short_id,
    summary: c.summary,
    author: c.author,
    email: c.email,
    time: c.time,
    parents: c.parents,
  }));
}

export async function gitDiff(path: string, file: string, staged: boolean): Promise<string> {
  return invoke<string>('git_diff', { path, file, staged });
}

export async function gitStage(path: string, files: string[]): Promise<void> {
  return invoke<void>('git_stage', { path, files });
}

export async function gitUnstage(path: string, files: string[]): Promise<void> {
  return invoke<void>('git_unstage', { path, files });
}

export async function gitCommit(path: string, message: string): Promise<string> {
  return invoke<string>('git_commit', { path, message });
}

export async function gitBranches(path: string): Promise<GitBranch[]> {
  const raw = await invoke<RawBranch[]>('git_branches', { path });
  return raw.map((b) => ({
    name: b.name,
    isRemote: b.is_remote,
    isHead: b.is_head,
    upstream: b.upstream,
  }));
}

export async function gitCheckout(path: string, branch: string): Promise<void> {
  return invoke<void>('git_checkout', { path, branch });
}

export async function gitFetch(path: string, remote?: string): Promise<void> {
  return invoke<void>('git_fetch', { path, remote });
}

export async function gitPull(path: string, remote?: string): Promise<string> {
  return invoke<string>('git_pull', { path, remote });
}

export async function gitPush(path: string, remote?: string, branch?: string): Promise<void> {
  return invoke<void>('git_push', { path, remote, branch });
}
