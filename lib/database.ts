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

const createRestDBAdapter = (): DBAdapter => {

  const makeRequest = async (method: string, table: string, id?: string, body?: unknown, query?: string): Promise<unknown> => {
    let apiBaseUrl = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
    
    if (!apiBaseUrl) {
      apiBaseUrl = typeof window !== 'undefined' ? '/.netlify/functions/api/api/tables' : '/api/tables';
      console.log('[DB:rest] Using default API base URL:', apiBaseUrl);
    } else {
      apiBaseUrl = `${apiBaseUrl}/api/tables`;
    }
    
    if (!apiBaseUrl) {
      console.error('[DB:rest] Missing API base URL');
      throw new Error('Missing API base URL');
    }
    
    let url = `${apiBaseUrl}/${table}`;
    if (id) url += `/${id}`;
    if (query) url += `?${query}`;
    
    console.log(`[DB:rest] ${method} ${url}`);
    console.log('[DB:rest] Request body:', body ? JSON.stringify(body).substring(0, 200) : 'none');
    
    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      console.log(`[DB:rest] Response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[DB:rest] Error ${response.status}:`, errorText);
        if (response.status === 404) {
          if (method === 'GET') {
            return null;
          }
          throw new Error(`Resource not found: ${url}`);
        }
        throw new Error(`Database request failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log('[DB:rest] Response data:', JSON.stringify(data).substring(0, 200));
      return data;
    } catch (error) {
      console.error(`[DB:rest] Request failed for ${method} ${url}:`, error);
      throw error;
    }
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
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const result = await makeRequest('POST', 'rooms', code, roomData);
      console.log('[DB:rest] createRoom', { code });
      return (result as DBRoom) || roomData;
    },

    async getRoom(code) {
      const result = await makeRequest('GET', 'rooms', code);
      console.log('[DB:rest] getRoom', { code, found: Boolean(result) });
      return result as DBRoom | null;
    },

    async updateRoom(code, updates) {
      const updatedData = {
        ...updates,
        updated_at: new Date().toISOString(),
      };
      await makeRequest('PATCH', 'rooms', code, updatedData);
      console.log('[DB:rest] updateRoom', { code, keys: Object.keys(updates) });
    },

    async createPlayer(id, roomCode, name) {
      const playerData: DBPlayer = {
        id,
        room_code: roomCode,
        name,
        team: null,
        role: 'guesser',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const result = await makeRequest('POST', 'players', id, playerData);
      console.log('[DB:rest] createPlayer', { id, roomCode });
      return (result as DBPlayer) || playerData;
    },

    async getPlayer(id) {
      const result = await makeRequest('GET', 'players', id);
      console.log('[DB:rest] getPlayer', { id, found: Boolean(result) });
      return result as DBPlayer | null;
    },

    async updatePlayer(id, updates) {
      const updatedData = {
        ...updates,
        updated_at: new Date().toISOString(),
      };
      await makeRequest('PATCH', 'players', id, updatedData);
      console.log('[DB:rest] updatePlayer', { id, keys: Object.keys(updates) });
    },

    async getPlayersByRoom(roomCode) {
      try {
        const query = `room_code=${encodeURIComponent(roomCode)}&is_active=true`;
        const result = await makeRequest('GET', 'players', undefined, undefined, query);
        const players = Array.isArray(result) ? result : [];
        console.log('[DB:rest] getPlayersByRoom', { roomCode, count: players.length });
        return players as DBPlayer[];
      } catch (error) {
        console.error('[DB:rest] getPlayersByRoom error:', error);
        return [];
      }
    },

    async deletePlayer(id) {
      await makeRequest('DELETE', 'players', id);
      console.log('[DB:rest] deletePlayer', { id });
    },
  };

  return adapter;
};

const adapter: DBAdapter = createRestDBAdapter();

export const db: DBAdapter = adapter;
export type { DBRoom, DBPlayer };
