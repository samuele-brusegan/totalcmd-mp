export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = bytes / Math.pow(k, i);
  return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

export function formatDate(isoString: string | null): string {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    const now = new Date();
    const isThisYear = date.getFullYear() === now.getFullYear();

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    if (isThisYear) {
      return `${day}/${month} ${hours}:${minutes}`;
    }
    return `${day}/${month}/${date.getFullYear()} ${hours}:${minutes}`;
  } catch {
    return '';
  }
}

export function getFileTypeClass(entry: { isDirectory: boolean; isSymlink: boolean; extension: string | null; name: string }): string {
  if (entry.isDirectory) return 'text-[var(--color-dir)]';
  if (entry.isSymlink) return 'text-[var(--color-symlink)]';

  const archiveExts = ['zip', 'tar', 'gz', 'bz2', '7z', 'rar', 'xz', 'tgz'];
  const execExts = ['sh', 'bash', 'exe', 'bat', 'cmd', 'ps1', 'py', 'rb', 'pl'];

  const ext = entry.extension?.toLowerCase() || '';
  if (archiveExts.includes(ext)) return 'text-[var(--color-archive)]';
  if (execExts.includes(ext)) return 'text-[var(--color-exec)]';

  return 'text-[var(--color-text-primary)]';
}
