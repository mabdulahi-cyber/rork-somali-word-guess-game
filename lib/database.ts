import Surreal from 'surrealdb.js';
import type { CardType, Team } from '@/types/game';

interface DBRoom {
  id?: string;
  code: string;
  words: string[];
  key_map: CardType[];
  revealed: boolean[];
  turn_team: Team;
  turn_status: string;
  game_status: string;
  hint_word?: string;
  hint_number?: number;
  guesses_left: number;
  winner_team?: Team;
  version: number;
  created_at?: string;
  updated_at?: string;
}

interface DBPlayer {
  id: string;
  room_code: string;
  name: string;
  team: Team | null;
  role: 'spymaster' | 'guesser';
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface DBAdapter {
  createRoom: (code: string, words: string[], keyMap: CardType[], startingTeam: Team) => Promise<DBRoom>;
  getRoom: (code: string) => Promise<DBRoom | null>;
  updateRoom: (code: string, updates: Partial<DBRoom>) => Promise<void>;

  createPlayer: (id: string, roomCode: string, name: string) => Promise<DBPlayer>;
  getPlayer: (id: string) => Promise<DBPlayer | null>;
  updatePlayer: (id: string, updates: Partial<DBPlayer>) => Promise<void>;
  getPlayersByRoom: (roomCode: string) => Promise<DBPlayer[]>;
  deletePlayer: (id: string) => Promise<void>;
}

type DbConfig = {
  endpoint: string;
  namespace: string;
  token: string;
};

const getProcessEnv = (): Record<string, string | undefined> => {
  const proc = typeof process !== 'undefined' ? (process as any) : undefined;
  const env = proc?.env;
  if (env && typeof env === 'object') return env as Record<string, string | undefined>;
  return {};
};

const getDbConfig = (): DbConfig | null => {
  const env = getProcessEnv();
  const endpoint = env.EXPO_PUBLIC_RORK_DB_ENDPOINT;
  const namespace = env.EXPO_PUBLIC_RORK_DB_NAMESPACE;
  const token = env.EXPO_PUBLIC_RORK_DB_TOKEN;

  if (!endpoint || !namespace || !token) {
    console.warn('[DB] Missing Rork database environment variables; falling back to in-memory DB.');
    console.warn('[DB] endpoint present:', Boolean(endpoint));
    console.warn('[DB] namespace present:', Boolean(namespace));
    console.warn('[DB] token present:', Boolean(token));
    return null;
  }

  return { endpoint, namespace, token };
};

const createMemoryAdapter = (): DBAdapter => {
  const rooms = new Map<string, DBRoom>();
  const players = new Map<string, DBPlayer>();

  const nowIso = () => new Date().toISOString();

  const adapter: DBAdapter = {
    async createRoom(code, words, keyMap, startingTeam) {
      const roomData: DBRoom = {
        code,
        words,
        key_map: keyMap,
        revealed: Array(25).fill(false),
        turn_team: startingTeam,
        turn_status: 'WAITING_HINT',
        game_status: 'PLAYING',
        guesses_left: 0,
        version: 1,
        created_at: nowIso(),
        updated_at: nowIso(),
      };

      rooms.set(code, roomData);
      console.log('[DB:memory] createRoom', { code });
      return roomData;
    },

    async getRoom(code) {
      const room = rooms.get(code) ?? null;
      console.log('[DB:memory] getRoom', { code, found: Boolean(room) });
      return room;
    },

    async updateRoom(code, updates) {
      const existing = rooms.get(code);
      if (!existing) {
        console.warn('[DB:memory] updateRoom attempted on missing room', { code });
        return;
      }

      const merged: DBRoom = {
        ...existing,
        ...updates,
        updated_at: nowIso(),
      };

      rooms.set(code, merged);
      console.log('[DB:memory] updateRoom', { code, keys: Object.keys(updates) });
    },

    async createPlayer(id, roomCode, name) {
      const playerData: DBPlayer = {
        id,
        room_code: roomCode,
        name,
        team: null,
        role: 'guesser',
        is_active: true,
        created_at: nowIso(),
        updated_at: nowIso(),
      };

      players.set(id, playerData);
      console.log('[DB:memory] createPlayer', { id, roomCode });
      return playerData;
    },

    async getPlayer(id) {
      const player = players.get(id) ?? null;
      console.log('[DB:memory] getPlayer', { id, found: Boolean(player) });
      return player;
    },

    async updatePlayer(id, updates) {
      const existing = players.get(id);
      if (!existing) {
        console.warn('[DB:memory] updatePlayer attempted on missing player', { id });
        return;
      }

      const merged: DBPlayer = {
        ...existing,
        ...updates,
        updated_at: nowIso(),
      };

      players.set(id, merged);
      console.log('[DB:memory] updatePlayer', { id, keys: Object.keys(updates) });
    },

    async getPlayersByRoom(roomCode) {
      const list = Array.from(players.values()).filter(
        (p) => p.room_code === roomCode && p.is_active === true,
      );
      console.log('[DB:memory] getPlayersByRoom', { roomCode, count: list.length });
      return list;
    },

    async deletePlayer(id) {
      players.delete(id);
      console.log('[DB:memory] deletePlayer', { id });
    },
  };

  return adapter;
};

const createSurrealAdapter = (config: DbConfig): DBAdapter => {
  let dbInstance: Surreal | null = null;

  const getDb = async (): Promise<Surreal> => {
    if (dbInstance) return dbInstance;

    console.log('[DB:surreal] Connecting to SurrealDB...');

    const db = new Surreal();
    await db.connect(config.endpoint);
    await db.authenticate(config.token);
    await db.use({ namespace: config.namespace, database: 'somali-codenames' });

    dbInstance = db;
    console.log('[DB:surreal] Connected');
    return db;
  };

  const adapter: DBAdapter = {
    async createRoom(code, words, keyMap, startingTeam) {
      const roomData: DBRoom = {
        code,
        words,
        key_map: keyMap,
        revealed: Array(25).fill(false),
        turn_team: startingTeam,
        turn_status: 'WAITING_HINT',
        game_status: 'PLAYING',
        guesses_left: 0,
        version: 1,
      };

      try {
        const db = await getDb();
        const query = `CREATE rooms:${code} CONTENT $data`;
        const result = await db.query(query, { data: roomData });
        return ((result?.[0] as DBRoom[])?.[0] || (result?.[0] as DBRoom)) as DBRoom;
      } catch (error) {
        console.error('[DB:surreal] createRoom error:', error);
        throw error;
      }
    },

    async getRoom(code) {
      try {
        const db = await getDb();
        const result = (await db.select(`rooms:${code}`)) as unknown as DBRoom;
        return result || null;
      } catch (error) {
        console.error('[DB:surreal] getRoom error:', error);
        return null;
      }
    },

    async updateRoom(code, updates) {
      try {
        const db = await getDb();
        await db.merge(`rooms:${code}`, updates);
      } catch (error) {
        console.error('[DB:surreal] updateRoom error:', error);
        throw error;
      }
    },

    async createPlayer(id, roomCode, name) {
      const playerData: DBPlayer = {
        id,
        room_code: roomCode,
        name,
        team: null,
        role: 'guesser',
        is_active: true,
      };

      try {
        const db = await getDb();
        const query = `CREATE players:${id} CONTENT $data`;
        const result = await db.query(query, { data: playerData });
        return ((result?.[0] as DBPlayer[])?.[0] || (result?.[0] as DBPlayer)) as DBPlayer;
      } catch (error) {
        console.error('[DB:surreal] createPlayer error:', error);
        throw error;
      }
    },

    async getPlayer(id) {
      try {
        const db = await getDb();
        const result = (await db.select(`players:${id}`)) as unknown as DBPlayer;
        return result || null;
      } catch (error) {
        console.error('[DB:surreal] getPlayer error:', error);
        return null;
      }
    },

    async updatePlayer(id, updates) {
      try {
        const db = await getDb();
        await db.merge(`players:${id}`, updates);
      } catch (error) {
        console.error('[DB:surreal] updatePlayer error:', error);
        throw error;
      }
    },

    async getPlayersByRoom(roomCode) {
      try {
        const db = await getDb();
        const result = await db.query(
          'SELECT * FROM players WHERE room_code = $roomCode AND is_active = true',
          { roomCode },
        );
        return ((result?.[0] as DBPlayer[]) || []) as DBPlayer[];
      } catch (error) {
        console.error('[DB:surreal] getPlayersByRoom error:', error);
        return [];
      }
    },

    async deletePlayer(id) {
      try {
        const db = await getDb();
        await db.delete(`players:${id}`);
      } catch (error) {
        console.error('[DB:surreal] deletePlayer error:', error);
        throw error;
      }
    },
  };

  return adapter;
};

const adapter: DBAdapter = (() => {
  const config = getDbConfig();
  if (config) return createSurrealAdapter(config);
  return createMemoryAdapter();
})();

export const db: DBAdapter = adapter;
export type { DBRoom, DBPlayer };
