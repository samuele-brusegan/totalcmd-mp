export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isSymlink: boolean;
  size: number;
  modified: string | null;
  created: string | null;
  extension: string | null;
  permissions: string | null;
}

export interface DriveInfo {
  name: string;
  mountPoint: string;
  totalSpace: number | null;
  availableSpace: number | null;
}

export type SortColumn = 'name' | 'size' | 'modified' | 'extension';
export type SortDirection = 'asc' | 'desc';
export type PanelSide = 'left' | 'right';

export interface PanelState {
  tabs: PanelTab[];
  activeTabIndex: number;
}

export type Protocol = 'ftp' | 'sftp';

export interface Connection {
  id: string;
  name: string;
  protocol: Protocol;
  host: string;
  port: number;
  username: string;
  password?: string;
  remotePath: string;
  useKeyAuth: boolean;
  keyPath?: string;
  usePassive: boolean;
  useFtps: boolean;
  allowInvalidCerts?: boolean;
  /** SHA-256 fingerprint of the only certificate accepted (cert pinning). */
  pinnedCertSha256?: string | null;
}

export interface PanelTab {
  id: string;
  label: string;
  currentPath: string;
  files: FileEntry[];
  selectedFiles: Set<string>;
  cursorIndex: number;
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  history: string[];
  historyIndex: number;
  filter: string;
  loading: boolean;
  error: string | null;
  connectionId?: string;
  isRemote?: boolean;
}
