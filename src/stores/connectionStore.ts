import { create } from 'zustand';
import type { Connection } from '../types';
import {
  getConnections,
  saveConnection as saveConn,
  updateConnection as updateConn,
  deleteConnection as deleteConn,
} from '../services/connections';

interface ConnectionStore {
  connections: Connection[];
  loading: boolean;

  loadConnections: () => Promise<void>;
  addConnection: (conn: Connection) => Promise<Connection>;
  editConnection: (conn: Connection) => Promise<void>;
  removeConnection: (id: string) => Promise<void>;
}

export const useConnectionStore = create<ConnectionStore>((set) => ({
  connections: [],
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
}));
