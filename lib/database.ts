import Surreal from 'surrealdb.js';
import type { CardType, Team } from '@/types/game';

const resolveEnv = (key: string): string | undefined => {
  return (process.env as Record<string, string | undefined>)[key];
};

let _db: Surreal | null = null;

export const getDB = async (): Promise<Surreal> => {
  if (_db) return _db;

  const endpoint = resolveEnv('EXPO_PUBLIC_RORK_DB_ENDPOINT');
  const namespace = resolveEnv('EXPO_PUBLIC_RORK_DB_NAMESPACE');
  const token = resolveEnv('EXPO_PUBLIC_RORK_DB_TOKEN');

  if (!endpoint || !namespace || !token) {
    throw new Error('[DB] Missing Rork database env vars');
  }

  _db = new Surreal();
  
  try {
    await _db.connect(endpoint, {
      namespace,
      database: 'rork',
    });
    
    await _db.authenticate(token);
    
    console.log('[DB] Connected to Rork database');
    return _db;
  } catch (error) {
    console.error('[DB] Connection failed:', error);
    throw error;
  }
};

interface DBRoom {
  id: string;
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
}

interface DBPlayer {
  id: string;
  room_code: string;
  name: string;
  team: Team | null;
  role: 'spymaster' | 'guesser';
  is_active: boolean;
}

export const db = {
  async createRoom(code: string, words: string[], keyMap: CardType[], startingTeam: Team): Promise<DBRoom> {
    const instance = await getDB();
    const roomId = `rooms:${code}`;
    
    const result = await instance.create(roomId, {
      code,
      words,
      key_map: keyMap,
      revealed: Array(25).fill(false),
      turn_team: startingTeam,
      turn_status: 'WAITING_HINT',
      game_status: 'PLAYING',
      guesses_left: 0,
      version: 1,
    });
    
    return result as any as DBRoom;
  },

  async getRoom(code: string): Promise<DBRoom | null> {
    const instance = await getDB();
    try {
      const result = await instance.select(`rooms:${code}`);
      return (result as any) || null;
    } catch {
      return null;
    }
  },

  async updateRoom(code: string, updates: Partial<DBRoom>): Promise<void> {
    const instance = await getDB();
    await instance.merge(`rooms:${code}`, updates);
  },

  async createPlayer(id: string, roomCode: string, name: string): Promise<DBPlayer> {
    const instance = await getDB();
    const playerId = `players:${id}`;
    
    const result = await instance.create(playerId, {
      id,
      room_code: roomCode,
      name,
      team: null,
      role: 'guesser',
      is_active: true,
    });
    
    return result as any as DBPlayer;
  },

  async getPlayer(id: string): Promise<DBPlayer | null> {
    const instance = await getDB();
    try {
      const result = await instance.select(`players:${id}`);
      return (result as any) || null;
    } catch {
      return null;
    }
  },

  async updatePlayer(id: string, updates: Partial<DBPlayer>): Promise<void> {
    const instance = await getDB();
    await instance.merge(`players:${id}`, updates);
  },

  async getPlayersByRoom(roomCode: string): Promise<DBPlayer[]> {
    const instance = await getDB();
    const query = `SELECT * FROM players WHERE room_code = $roomCode AND is_active = true`;
    const result = await instance.query(query, { roomCode });
    return (result[0] as any) || [];
  },

  async deletePlayer(id: string): Promise<void> {
    const instance = await getDB();
    await instance.delete(`players:${id}`);
  },
};
