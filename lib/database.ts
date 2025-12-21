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

  console.log('[DB] Environment check:', {
    hasEndpoint: !!endpoint,
    hasNamespace: !!namespace,
    hasToken: !!token,
    endpoint: endpoint?.substring(0, 30) + '...'
  });

  if (!endpoint || !namespace || !token) {
    const missing = [];
    if (!endpoint) missing.push('EXPO_PUBLIC_RORK_DB_ENDPOINT');
    if (!namespace) missing.push('EXPO_PUBLIC_RORK_DB_NAMESPACE');
    if (!token) missing.push('EXPO_PUBLIC_RORK_DB_TOKEN');
    throw new Error(`[DB] Missing environment variables: ${missing.join(', ')}`);
  }

  _db = new Surreal();
  
  try {
    console.log('[DB] Attempting to connect to:', endpoint.substring(0, 50) + '...');
    
    await _db.connect(endpoint, {
      namespace,
      database: 'rork',
    });
    
    console.log('[DB] Connection established, authenticating...');
    await _db.authenticate(token);
    
    console.log('[DB] Successfully connected and authenticated to Rork database');
    return _db;
  } catch (error: any) {
    console.error('[DB] Connection failed:', JSON.stringify({
      message: error?.message,
      name: error?.name,
      code: error?.code,
      stack: error?.stack?.substring(0, 200)
    }, null, 2));
    
    _db = null;
    
    if (error?.message?.includes('not_found') || error?.message?.includes('Unexpected character')) {
      throw new Error('[DB] Database endpoint not found. Please verify EXPO_PUBLIC_RORK_DB_ENDPOINT is correct.');
    }
    
    throw new Error(`[DB] Failed to connect: ${error?.message || 'Unknown error'}`);
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
