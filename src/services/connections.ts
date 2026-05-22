import { invoke } from '@tauri-apps/api/core';
import type { Connection, FileEntry } from '../types';

export async function getConnections(): Promise<Connection[]> {
  return invoke<Connection[]>('get_connections');
}

export async function saveConnection(connection: Connection): Promise<Connection> {
  return invoke<Connection>('save_connection', { connection });
}

export async function updateConnection(connection: Connection): Promise<void> {
  return invoke<void>('update_connection', { connection });
}

export async function deleteConnection(id: string): Promise<void> {
  return invoke<void>('delete_connection', { id });
}

export async function testConnection(connection: Connection): Promise<string> {
  return invoke<string>('test_connection', { connection });
}

export async function remoteListDir(connectionId: string, path: string): Promise<FileEntry[]> {
  return invoke<FileEntry[]>('remote_list_dir', { connectionId, path });
}

export async function remoteDownload(connectionId: string, remotePath: string, localPath: string): Promise<number> {
  return invoke<number>('remote_download', { connectionId, remotePath, localPath });
}

export async function remoteUpload(connectionId: string, localPath: string, remotePath: string): Promise<number> {
  return invoke<number>('remote_upload', { connectionId, localPath, remotePath });
}

export async function remoteMkdir(connectionId: string, path: string): Promise<void> {
  return invoke<void>('remote_mkdir', { connectionId, path });
}

export async function remoteDelete(connectionId: string, paths: string[], isDir: boolean[]): Promise<void> {
  return invoke<void>('remote_delete', { connectionId, paths, isDir });
}

export async function remoteRename(connectionId: string, from: string, to: string): Promise<void> {
  return invoke<void>('remote_rename', { connectionId, from, to });
}
