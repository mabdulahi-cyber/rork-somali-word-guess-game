import Surreal from 'surrealdb.js';
import type { CardType, Team } from '@/types/game';

interface DBRoom {
  [key: string]: unknown;
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
  [key: string]: unknown;
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

const createSurrealDBAdapter = (): DBAdapter => {
  let dbInstance: Surreal | null = null;
  let connectPromise: Promise<void> | null = null;

  const getDB = async (): Promise<Surreal> => {
    if (dbInstance) return dbInstance;

    if (connectPromise) {
      await connectPromise;
      return dbInstance!;
    }

    connectPromise = (async () => {
      try {
        const endpoint = process.env.EXPO_PUBLIC_RORK_DB_ENDPOINT;
        const namespace = process.env.EXPO_PUBLIC_RORK_DB_NAMESPACE;
        const token = process.env.EXPO_PUBLIC_RORK_DB_TOKEN;

        if (!endpoint || !namespace || !token) {
          throw new Error('Missing SurrealDB configuration');
        }

        console.log('[DB:surreal] Connecting to SurrealDB...', { endpoint });

        dbInstance = new Surreal();
        await dbInstance.connect(endpoint, {
          namespace,
          database: 'somali_codenames',
          auth: { token },
        });

        console.log('[DB:surreal] Connected successfully');
      } catch (error) {
        console.error('[DB:surreal] Connection failed:', error);
        dbInstance = null;
        connectPromise = null;
        throw error;
      }
    })();

    await connectPromise;
    return dbInstance!;
  };

  const adapter: DBAdapter = {
    async createRoom(code, words, keyMap, startingTeam) {
      const db = await getDB();
      const roomData = {
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

      const result = await db.create(`rooms:${code}`, roomData);
      const created = Array.isArray(result) ? result[0] : result;
      console.log('[DB:surreal] createRoom', { code });
      return created as unknown as DBRoom;
    },

    async getRoom(code) {
      const db = await getDB();
      const result = await db.select<DBRoom>(`rooms:${code}`);
      const room = Array.isArray(result) ? result[0] : result;
      console.log('[DB:surreal] getRoom', { code, found: Boolean(room) });
      return room || null;
    },

    async updateRoom(code, updates) {
      const db = await getDB();
      await db.merge(`rooms:${code}`, updates);
      console.log('[DB:surreal] updateRoom', { code, keys: Object.keys(updates) });
    },

    async createPlayer(id, roomCode, name) {
      const db = await getDB();
      const playerData = {
        id,
        room_code: roomCode,
        name,
        team: null,
        role: 'guesser' as const,
        is_active: true,
      };

      const result = await db.create(`players:${id}`, playerData);
      const created = Array.isArray(result) ? result[0] : result;
      console.log('[DB:surreal] createPlayer', { id, roomCode });
      return created as unknown as DBPlayer;
    },

    async getPlayer(id) {
      const db = await getDB();
      const result = await db.select<DBPlayer>(`players:${id}`);
      const player = Array.isArray(result) ? result[0] : result;
      console.log('[DB:surreal] getPlayer', { id, found: Boolean(player) });
      return player || null;
    },

    async updatePlayer(id, updates) {
      const db = await getDB();
      await db.merge(`players:${id}`, updates);
      console.log('[DB:surreal] updatePlayer', { id, keys: Object.keys(updates) });
    },

    async getPlayersByRoom(roomCode) {
      const db = await getDB();
      const query = `SELECT * FROM players WHERE room_code = $roomCode AND is_active = true`;
      const result = await db.query<[DBPlayer[]]>(query, { roomCode });
      const players = result?.[0] || [];
      console.log('[DB:surreal] getPlayersByRoom', { roomCode, count: players.length });
      return players;
    },

    async deletePlayer(id) {
      const db = await getDB();
      await db.delete(`players:${id}`);
      console.log('[DB:surreal] deletePlayer', { id });
    },
  };

  return adapter;
};

const adapter: DBAdapter = createSurrealDBAdapter();

export const db: DBAdapter = adapter;
export type { DBRoom, DBPlayer };
