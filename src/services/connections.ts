import { invoke } from '@tauri-apps/api/core';
import type { Connection, FileEntry } from '../types';

/** Tab/breadcrumb label for a remote connection: e.g. `FTPS example.com`. */
export function connectionTabLabel(conn: Connection): string {
  const proto =
    conn.protocol === 'sftp' ? 'SFTP' : conn.useFtps ? 'FTPS' : 'FTP';
  return `${proto} ${conn.host}`;
}

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

export interface CertInfo {
  subject: string;
  issuer: string;
  notBefore: string;
  notAfter: string;
  fingerprintSha256: string;
  serial: string;
  sans: string[];
  selfSigned: boolean;
  expired: boolean;
  hostnameMatches: boolean;
  hostQueried: string;
}

interface RawCertInfo {
  subject: string;
  issuer: string;
  not_before: string;
  not_after: string;
  fingerprint_sha256: string;
  serial: string;
  sans: string[];
  self_signed: boolean;
  expired: boolean;
  hostname_matches: boolean;
  host_queried: string;
}

export async function inspectFtpsCertificate(
  host: string,
  port: number,
  implicit = false
): Promise<CertInfo> {
  const raw = await invoke<RawCertInfo>('inspect_ftps_certificate', { host, port, implicit });
  return {
    subject: raw.subject,
    issuer: raw.issuer,
    notBefore: raw.not_before,
    notAfter: raw.not_after,
    fingerprintSha256: raw.fingerprint_sha256,
    serial: raw.serial,
    sans: raw.sans,
    selfSigned: raw.self_signed,
    expired: raw.expired,
    hostnameMatches: raw.hostname_matches,
    hostQueried: raw.host_queried,
  };
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

export async function remoteCopyToLocal(
  transferId: string,
  connectionId: string,
  remotePaths: string[],
  isDir: boolean[],
  localDest: string,
  parallel: number
): Promise<number> {
  return invoke<number>('remote_copy_to_local', {
    transferId,
    connectionId,
    remotePaths,
    isDir,
    localDest,
    parallel,
  });
}

export async function remoteCopyFromLocal(
  transferId: string,
  connectionId: string,
  localPaths: string[],
  remoteDest: string,
  parallel: number
): Promise<number> {
  return invoke<number>('remote_copy_from_local', {
    transferId,
    connectionId,
    localPaths,
    remoteDest,
    parallel,
  });
}

export async function transferCancel(transferId: string): Promise<void> {
  return invoke<void>('transfer_cancel', { transferId });
}

export async function transferSetPaused(
  transferId: string,
  paused: boolean
): Promise<void> {
  return invoke<void>('transfer_set_paused', { transferId, paused });
}
