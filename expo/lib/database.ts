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
  role: 'spymaster' | 'guesser' | 'spectator';
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

const createRemoteDBAdapter = (): DBAdapter => {
  const getApiUrl = () => {
    // In Rork preview: use system-provided URL
    // In Netlify/production: use relative /api path (works with netlify.toml redirect)
    const baseUrl = process.env.EXPO_PUBLIC_RORK_API_BASE_URL || '/api';
    const cleanUrl = baseUrl.replace(/\/$/, '');
    console.log('[DB:remote] Using API URL:', cleanUrl, '(from env:', !!process.env.EXPO_PUBLIC_RORK_API_BASE_URL, ')');
    return cleanUrl;
  };

  const adapter: DBAdapter = {
    async createRoom(code, words, keyMap, startingTeam) {
      const apiUrl = getApiUrl();
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

      console.log('[DB:remote] createRoom', { code, apiUrl });
      const response = await fetch(`${apiUrl}/tables/rooms/${code}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roomData),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('[DB:remote] createRoom failed:', response.status, error);
        throw new Error(`Failed to create room: ${error}`);
      }

      const result = await response.json();
      console.log('[DB:remote] createRoom success');
      return result;
    },

    async getRoom(code) {
      const apiUrl = getApiUrl();
      console.log('[DB:remote] getRoom', { code, apiUrl });
      
      const response = await fetch(`${apiUrl}/tables/rooms/${code}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.status === 404) {
        console.log('[DB:remote] getRoom - room not found');
        return null;
      }

      if (!response.ok) {
        const error = await response.text();
        console.error('[DB:remote] getRoom failed:', response.status, error);
        throw new Error(`Failed to get room: ${error}`);
      }

      const result = await response.json();
      console.log('[DB:remote] getRoom success');
      return result;
    },

    async updateRoom(code, updates) {
      const apiUrl = getApiUrl();
      console.log('[DB:remote] updateRoom', { code, keys: Object.keys(updates) });
      
      const response = await fetch(`${apiUrl}/tables/rooms/${code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('[DB:remote] updateRoom failed:', response.status, error);
        throw new Error(`Failed to update room: ${error}`);
      }

      console.log('[DB:remote] updateRoom success');
    },

    async createPlayer(id, roomCode, name) {
      const apiUrl = getApiUrl();
      const playerData: DBPlayer = {
        id,
        room_code: roomCode,
        name,
        team: null,
        role: 'spectator',
        is_active: true,
      };

      console.log('[DB:remote] createPlayer', { id, roomCode });
      const response = await fetch(`${apiUrl}/tables/players/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(playerData),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('[DB:remote] createPlayer failed:', response.status, error);
        throw new Error(`Failed to create player: ${error}`);
      }

      const result = await response.json();
      console.log('[DB:remote] createPlayer success');
      return result;
    },

    async getPlayer(id) {
      const apiUrl = getApiUrl();
      console.log('[DB:remote] getPlayer', { id });
      
      const response = await fetch(`${apiUrl}/tables/players/${id}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.status === 404) {
        console.log('[DB:remote] getPlayer - player not found');
        return null;
      }

      if (!response.ok) {
        const error = await response.text();
        console.error('[DB:remote] getPlayer failed:', response.status, error);
        throw new Error(`Failed to get player: ${error}`);
      }

      const result = await response.json();
      console.log('[DB:remote] getPlayer success');
      return result;
    },

    async updatePlayer(id, updates) {
      const apiUrl = getApiUrl();
      console.log('[DB:remote] updatePlayer', { id, keys: Object.keys(updates) });
      
      const response = await fetch(`${apiUrl}/tables/players/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('[DB:remote] updatePlayer failed:', response.status, error);
        throw new Error(`Failed to update player: ${error}`);
      }

      console.log('[DB:remote] updatePlayer success');
    },

    async getPlayersByRoom(roomCode) {
      const apiUrl = getApiUrl();
      console.log('[DB:remote] getPlayersByRoom', { roomCode });
      
      try {
        const response = await fetch(`${apiUrl}/tables/players?room_code=${roomCode}&is_active=true`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          const error = await response.text();
          console.error('[DB:remote] getPlayersByRoom failed:', response.status, error);
          return [];
        }

        const result = await response.json();
        console.log('[DB:remote] getPlayersByRoom success, count:', result.length);
        return result;
      } catch (error) {
        console.error('[DB:remote] getPlayersByRoom error:', error);
        return [];
      }
    },

    async deletePlayer(id) {
      const apiUrl = getApiUrl();
      console.log('[DB:remote] deletePlayer', { id });
      
      const response = await fetch(`${apiUrl}/tables/players/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('[DB:remote] deletePlayer failed:', response.status, error);
        throw new Error(`Failed to delete player: ${error}`);
      }

      console.log('[DB:remote] deletePlayer success');
    },
  };

  return adapter;
};

const adapter: DBAdapter = createRemoteDBAdapter();

export const db: DBAdapter = adapter;
export type { DBRoom, DBPlayer };
