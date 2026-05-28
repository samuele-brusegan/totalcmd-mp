import type { PanelTab } from '../types';
import { copyItems, moveItems, deleteItems } from './localFs';
import {
  remoteCopyToLocal,
  remoteCopyFromLocal,
  remoteDelete,
} from './connections';
import { useTransferStore } from '../stores/transferStore';
import { useSettingsStore } from '../stores/settingsStore';

interface CopyArgs {
  sourceTab: PanelTab;
  sourcePaths: string[];
  destTab: PanelTab;
  destDir: string;
}

function isDirFor(tab: PanelTab, path: string): boolean {
  return Boolean(tab.files.find((f) => f.path === path)?.isDirectory);
}

function newId(): string {
  return crypto.randomUUID();
}

function transferLabel(args: CopyArgs, kind: string): string {
  const src = args.sourceTab.isRemote ? `[${args.sourceTab.label}]` : args.sourceTab.currentPath;
  const dst = args.destTab.isRemote ? `[${args.destTab.label}]` : args.destDir;
  return `${kind}: ${src} → ${dst}`;
}

export async function copyAcrossPanels(args: CopyArgs): Promise<string> {
  const { sourceTab, sourcePaths, destTab, destDir } = args;
  if (sourcePaths.length === 0) return 'No selection';

  const sourceRemote = Boolean(sourceTab.isRemote && sourceTab.connectionId);
  const destRemote = Boolean(destTab.isRemote && destTab.connectionId);

  // 1. local → local — fast path, no progress events from Rust yet, so fake one.
  if (!sourceRemote && !destRemote) {
    const id = newId();
    const store = useTransferStore.getState();
    store.registerLocal(id, transferLabel(args, 'Copy'));
    try {
      await copyItems(sourcePaths, destDir);
      store.finishLocal(id, true);
      return `Copied ${sourcePaths.length} item(s)`;
    } catch (e) {
      store.finishLocal(id, false, String(e));
      throw e;
    }
  }

  // 2. remote → local
  if (sourceRemote && !destRemote) {
    const id = newId();
    const isDir = sourcePaths.map((p) => isDirFor(sourceTab, p));
    // The store will populate progress from backend events; we just give it
    // a label up-front.
    useTransferStore.setState((s) => ({
      transfers: [
        ...s.transfers,
        {
          transferId: id,
          kind: 'download',
          label: transferLabel(args, 'Download'),
          currentFile: '',
          fileBytes: 0,
          fileTotal: 0,
          itemsDone: 0,
          itemsTotal: 0,
          bytesDone: 0,
          bytesTotal: 0,
          status: 'scanning',
          message: null,
        },
      ],
    }));
    const parallel = useSettingsStore.getState().ftpParallelTransfers;
    const bytes = await remoteCopyToLocal(
      id,
      sourceTab.connectionId!,
      sourcePaths,
      isDir,
      destDir,
      parallel
    );
    return `Downloaded ${sourcePaths.length} item(s) (${formatBytes(bytes)})`;
  }

  // 3. local → remote
  if (!sourceRemote && destRemote) {
    const id = newId();
    useTransferStore.setState((s) => ({
      transfers: [
        ...s.transfers,
        {
          transferId: id,
          kind: 'upload',
          label: transferLabel(args, 'Upload'),
          currentFile: '',
          fileBytes: 0,
          fileTotal: 0,
          itemsDone: 0,
          itemsTotal: 0,
          bytesDone: 0,
          bytesTotal: 0,
          status: 'scanning',
          message: null,
        },
      ],
    }));
    const parallel = useSettingsStore.getState().ftpParallelTransfers;
    const bytes = await remoteCopyFromLocal(
      id,
      destTab.connectionId!,
      sourcePaths,
      destDir,
      parallel
    );
    return `Uploaded ${sourcePaths.length} item(s) (${formatBytes(bytes)})`;
  }

  throw new Error(
    'Direct remote → remote copy is not supported yet. Download to a local panel first, then upload.'
  );
}

export async function moveAcrossPanels(args: CopyArgs): Promise<string> {
  const sourceRemote = Boolean(args.sourceTab.isRemote && args.sourceTab.connectionId);
  const destRemote = Boolean(args.destTab.isRemote && args.destTab.connectionId);

  if (!sourceRemote && !destRemote) {
    const id = newId();
    const store = useTransferStore.getState();
    store.registerLocal(id, transferLabel(args, 'Move'));
    try {
      await moveItems(args.sourcePaths, args.destDir);
      store.finishLocal(id, true);
      return `Moved ${args.sourcePaths.length} item(s)`;
    } catch (e) {
      store.finishLocal(id, false, String(e));
      throw e;
    }
  }

  const status = await copyAcrossPanels(args);
  if (sourceRemote) {
    const isDir = args.sourcePaths.map((p) => isDirFor(args.sourceTab, p));
    await remoteDelete(args.sourceTab.connectionId!, args.sourcePaths, isDir);
  } else {
    await deleteItems(args.sourcePaths);
  }
  return status.replace(/^Copied|^Downloaded|^Uploaded/, 'Moved');
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
