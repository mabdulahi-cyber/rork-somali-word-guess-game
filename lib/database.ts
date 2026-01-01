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

// Use in-memory adapter for reliable local gameplay
const adapter: DBAdapter = createMemoryAdapter();

export const db: DBAdapter = adapter;
export type { DBRoom, DBPlayer };
