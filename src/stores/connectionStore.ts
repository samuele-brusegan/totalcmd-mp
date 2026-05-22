import { create } from 'zustand';
import type { Connection, TransferItem } from '../types';
import {
  getConnections,
  saveConnection as saveConn,
  updateConnection as updateConn,
  deleteConnection as deleteConn,
} from '../services/connections';

interface ConnectionStore {
  connections: Connection[];
  transfers: TransferItem[];
  loading: boolean;

  loadConnections: () => Promise<void>;
  addConnection: (conn: Connection) => Promise<Connection>;
  editConnection: (conn: Connection) => Promise<void>;
  removeConnection: (id: string) => Promise<void>;

  addTransfer: (item: TransferItem) => void;
  updateTransfer: (id: string, updates: Partial<TransferItem>) => void;
  removeTransfer: (id: string) => void;
  clearCompleted: () => void;
}

export const useConnectionStore = create<ConnectionStore>((set) => ({
  connections: [],
  transfers: [],
  loading: false,

  loadConnections: async () => {
    set({ loading: true });
    try {
      const connections = await getConnections();
      set({ connections, loading: false });
    } catch (e) {
      console.error('Failed to load connections:', e);
      set({ loading: false });
    }
  },

  addConnection: async (conn: Connection) => {
    const saved = await saveConn(conn);
    set((s) => ({ connections: [...s.connections, saved] }));
    return saved;
  },

  editConnection: async (conn: Connection) => {
    await updateConn(conn);
    set((s) => ({
      connections: s.connections.map((c) => (c.id === conn.id ? conn : c)),
    }));
  },

  removeConnection: async (id: string) => {
    await deleteConn(id);
    set((s) => ({
      connections: s.connections.filter((c) => c.id !== id),
    }));
  },

  addTransfer: (item: TransferItem) => {
    set((s) => ({ transfers: [...s.transfers, item] }));
  },

  updateTransfer: (id: string, updates: Partial<TransferItem>) => {
    set((s) => ({
      transfers: s.transfers.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    }));
  },

  removeTransfer: (id: string) => {
    set((s) => ({ transfers: s.transfers.filter((t) => t.id !== id) }));
  },

  clearCompleted: () => {
    set((s) => ({
      transfers: s.transfers.filter((t) => t.status !== 'completed'),
    }));
  },
}));
