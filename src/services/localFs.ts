import { invoke } from '@tauri-apps/api/core';
import type { FileEntry, DriveInfo } from '../types';

export async function listLocalDir(path: string): Promise<FileEntry[]> {
  return invoke<FileEntry[]>('list_local_dir', { path });
}

export async function getHomeDir(): Promise<string> {
  return invoke<string>('get_home_dir');
}

export async function createDir(path: string): Promise<void> {
  return invoke<void>('create_dir', { path });
}

export async function deleteItems(paths: string[]): Promise<void> {
  return invoke<void>('delete_items', { paths });
}

export async function renameItem(oldPath: string, newPath: string): Promise<void> {
  return invoke<void>('rename_item', { oldPath, newPath });
}

export async function copyItems(sources: string[], destDir: string): Promise<void> {
  return invoke<void>('copy_items', { sources, destDir });
}

export async function moveItems(sources: string[], destDir: string): Promise<void> {
  return invoke<void>('move_items', { sources, destDir });
}

export async function getDrives(): Promise<DriveInfo[]> {
  return invoke<DriveInfo[]>('get_drives');
}

export async function readFileText(path: string, encoding?: string): Promise<string> {
  return invoke<string>('read_file_text', { path, encoding: encoding ?? null });
}
