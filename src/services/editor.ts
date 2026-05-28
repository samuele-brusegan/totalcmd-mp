import { invoke } from '@tauri-apps/api/core';

export interface EditSession {
  localPath: string;
  originalMtimeMs: number;
}

interface RawEditSession {
  local_path: string;
  original_mtime_ms: number;
}

export async function prepareRemoteForEdit(
  connectionId: string,
  remotePath: string
): Promise<EditSession> {
  const raw = await invoke<RawEditSession>('editor_prepare_remote', {
    connectionId,
    remotePath,
  });
  return {
    localPath: raw.local_path,
    originalMtimeMs: raw.original_mtime_ms,
  };
}

export async function finishRemoteEdit(
  connectionId: string,
  remotePath: string,
  localPath: string,
  originalMtimeMs: number
): Promise<boolean> {
  return invoke<boolean>('editor_finish_remote', {
    connectionId,
    remotePath,
    localPath,
    originalMtimeMs,
  });
}

export async function spawnExternalEditor(
  command: string,
  filePath: string
): Promise<void> {
  return invoke<void>('editor_spawn_external', { command, filePath });
}

export async function writeFileText(path: string, content: string): Promise<void> {
  return invoke<void>('write_file_text', { path, content });
}
