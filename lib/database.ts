import Surreal from 'surrealdb.js';
import type { CardType, Team } from '@/types/game';

const dbEndpoint = process.env.EXPO_PUBLIC_RORK_DB_ENDPOINT;
const dbNamespace = process.env.EXPO_PUBLIC_RORK_DB_NAMESPACE;
const dbToken = process.env.EXPO_PUBLIC_RORK_DB_TOKEN;

if (!dbEndpoint || !dbNamespace || !dbToken) {
  console.error('[DB] Missing Rork database environment variables');
  throw new Error('Game configuration error. Please try again later.');
}

let dbInstance: Surreal | null = null;

async function getDb(): Promise<Surreal> {
  if (dbInstance) return dbInstance;
  
  const db = new Surreal();
  await db.connect(dbEndpoint!);
  await db.authenticate(dbToken!);
  await db.use({ namespace: dbNamespace!, database: 'somali-codenames' });
  
  dbInstance = db;
  return db;
}

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

export const db = {
  async createRoom(code: string, words: string[], keyMap: CardType[], startingTeam: Team): Promise<DBRoom> {
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
      return (result?.[0] as DBRoom[])?.[0] || result?.[0] as DBRoom;
    } catch (error) {
      console.error('[DB] createRoom error:', error);
      throw error;
    }
  },

  async getRoom(code: string): Promise<DBRoom | null> {
    try {
      const db = await getDb();
      const result = await db.select(`rooms:${code}`) as unknown as DBRoom;
      return result || null;
    } catch (error) {
      console.error('[DB] getRoom error:', error);
      return null;
    }
  },

  async updateRoom(code: string, updates: Partial<DBRoom>): Promise<void> {
    try {
      const db = await getDb();
      await db.merge(`rooms:${code}`, updates);
    } catch (error) {
      console.error('[DB] updateRoom error:', error);
      throw error;
    }
  },

  async createPlayer(id: string, roomCode: string, name: string): Promise<DBPlayer> {
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
      return (result?.[0] as DBPlayer[])?.[0] || result?.[0] as DBPlayer;
    } catch (error) {
      console.error('[DB] createPlayer error:', error);
      throw error;
    }
  },

  async getPlayer(id: string): Promise<DBPlayer | null> {
    try {
      const db = await getDb();
      const result = await db.select(`players:${id}`) as unknown as DBPlayer;
      return result || null;
    } catch (error) {
      console.error('[DB] getPlayer error:', error);
      return null;
    }
  },

  async updatePlayer(id: string, updates: Partial<DBPlayer>): Promise<void> {
    try {
      const db = await getDb();
      await db.merge(`players:${id}`, updates);
    } catch (error) {
      console.error('[DB] updatePlayer error:', error);
      throw error;
    }
  },

  async getPlayersByRoom(roomCode: string): Promise<DBPlayer[]> {
    try {
      const db = await getDb();
      const result = await db.query(
        'SELECT * FROM players WHERE room_code = $roomCode AND is_active = true',
        { roomCode }
      );
      return (result?.[0] as DBPlayer[]) || [];
    } catch (error) {
      console.error('[DB] getPlayersByRoom error:', error);
      return [];
    }
  },

  async deletePlayer(id: string): Promise<void> {
    try {
      const db = await getDb();
      await db.delete(`players:${id}`);
    } catch (error) {
      console.error('[DB] deletePlayer error:', error);
      throw error;
    }
  },
};
