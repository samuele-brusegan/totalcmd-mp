import { create } from 'zustand';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { transferCancel, transferSetPaused } from '../services/connections';

export type TransferStatus =
  | 'scanning'
  | 'running'
  | 'paused'
  | 'cancelled'
  | 'done'
  | 'error';

export type TransferKind = 'download' | 'upload' | 'local';

export interface TransferProgress {
  transferId: string;
  kind: TransferKind;
  label: string; // human-readable, e.g. "ftps host → /local/dir"
  currentFile: string;
  fileBytes: number;
  fileTotal: number;
  itemsDone: number;
  itemsTotal: number;
  bytesDone: number;
  bytesTotal: number;
  status: TransferStatus;
  message: string | null;
}

interface BackendEvent {
  transferId: string;
  kind: string;
  currentFile: string;
  fileBytes: number;
  fileTotal: number;
  itemsDone: number;
  itemsTotal: number;
  bytesDone: number;
  bytesTotal: number;
  status: string;
  message: string | null;
}

interface TransferStore {
  transfers: TransferProgress[];
  panelMinimized: boolean;
  listenerStarted: boolean;

  startListening: () => Promise<void>;
  registerLocal: (id: string, label: string) => void;
  finishLocal: (id: string, ok: boolean, message?: string) => void;

  removeTransfer: (id: string) => void;
  clearFinished: () => void;
  cancel: (id: string) => Promise<void>;
  togglePause: (id: string) => Promise<void>;

  setMinimized: (v: boolean) => void;
}

let unlisten: UnlistenFn | undefined;

function statusFromString(s: string): TransferStatus {
  if (
    s === 'scanning' ||
    s === 'running' ||
    s === 'paused' ||
    s === 'cancelled' ||
    s === 'done' ||
    s === 'error'
  )
    return s;
  return 'running';
}

export const useTransferStore = create<TransferStore>((set, get) => ({
  transfers: [],
  panelMinimized: false,
  listenerStarted: false,

  startListening: async () => {
    if (get().listenerStarted) return;
    set({ listenerStarted: true });
    try {
      unlisten = await listen<BackendEvent>('transfer-progress', (event) => {
        const e = event.payload;
        const status = statusFromString(e.status);
        set((s) => {
          const existing = s.transfers.find((t) => t.transferId === e.transferId);
          const next: TransferProgress = {
            transferId: e.transferId,
            kind: (e.kind as TransferKind) || 'download',
            label: existing?.label ?? e.transferId,
            currentFile: e.currentFile,
            fileBytes: e.fileBytes,
            fileTotal: e.fileTotal,
            itemsDone: e.itemsDone,
            itemsTotal: e.itemsTotal,
            bytesDone: e.bytesDone,
            bytesTotal: e.bytesTotal,
            status,
            message: e.message,
          };
          if (existing) {
            return {
              transfers: s.transfers.map((t) =>
                t.transferId === e.transferId ? next : t
              ),
            };
          }
          return { transfers: [...s.transfers, next] };
        });
      });
    } catch (err) {
      console.error('transfer-progress listen failed:', err);
    }
  },

  registerLocal: (id, label) => {
    set((s) => ({
      transfers: [
        ...s.transfers,
        {
          transferId: id,
          kind: 'local',
          label,
          currentFile: '',
          fileBytes: 0,
          fileTotal: 0,
          itemsDone: 0,
          itemsTotal: 0,
          bytesDone: 0,
          bytesTotal: 0,
          status: 'running',
          message: null,
        },
      ],
    }));
  },

  finishLocal: (id, ok, message) => {
    set((s) => ({
      transfers: s.transfers.map((t) =>
        t.transferId === id
          ? {
              ...t,
              status: ok ? 'done' : 'error',
              message: message ?? t.message,
            }
          : t
      ),
    }));
  },

  removeTransfer: (id) => {
    set((s) => ({ transfers: s.transfers.filter((t) => t.transferId !== id) }));
  },

  clearFinished: () => {
    set((s) => ({
      transfers: s.transfers.filter(
        (t) => t.status === 'running' || t.status === 'paused' || t.status === 'scanning'
      ),
    }));
  },

  cancel: async (id) => {
    try {
      await transferCancel(id);
    } catch (err) {
      console.error('cancel failed:', err);
    }
  },

  togglePause: async (id) => {
    const t = get().transfers.find((x) => x.transferId === id);
    if (!t) return;
    const willPause = t.status !== 'paused';
    try {
      await transferSetPaused(id, willPause);
      set((s) => ({
        transfers: s.transfers.map((x) =>
          x.transferId === id
            ? { ...x, status: willPause ? 'paused' : 'running' }
            : x
        ),
      }));
    } catch (err) {
      console.error('pause failed:', err);
    }
  },

  setMinimized: (v) => set({ panelMinimized: v }),
}));

export function disposeTransferListener() {
  unlisten?.();
}
