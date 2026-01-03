import type { CardType, Team } from '@/types/game';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

const createLocalDBAdapter = (): DBAdapter => {
  const ROOMS_KEY = 'somali-codenames.rooms';
  const PLAYERS_KEY = 'somali-codenames.players';

  const loadRooms = async (): Promise<Record<string, DBRoom>> => {
    try {
      const data = await AsyncStorage.getItem(ROOMS_KEY);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('[DB:local] Failed to load rooms', error);
      return {};
    }
  };

  const saveRooms = async (rooms: Record<string, DBRoom>): Promise<void> => {
    try {
      await AsyncStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
    } catch (error) {
      console.error('[DB:local] Failed to save rooms', error);
    }
  };

  const loadPlayers = async (): Promise<Record<string, DBPlayer>> => {
    try {
      const data = await AsyncStorage.getItem(PLAYERS_KEY);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('[DB:local] Failed to load players', error);
      return {};
    }
  };

  const savePlayers = async (players: Record<string, DBPlayer>): Promise<void> => {
    try {
      await AsyncStorage.setItem(PLAYERS_KEY, JSON.stringify(players));
    } catch (error) {
      console.error('[DB:local] Failed to save players', error);
    }
  };

  const adapter: DBAdapter = {
    async createRoom(code, words, keyMap, startingTeam) {
      const rooms = await loadRooms();
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
      rooms[code] = roomData;
      await saveRooms(rooms);
      console.log('[DB:local] createRoom', { code });
      return roomData;
    },

    async getRoom(code) {
      const rooms = await loadRooms();
      const room = rooms[code] || null;
      console.log('[DB:local] getRoom', { code, found: Boolean(room) });
      return room;
    },

    async updateRoom(code, updates) {
      const rooms = await loadRooms();
      if (!rooms[code]) {
        console.warn('[DB:local] updateRoom - room not found', code);
        return;
      }
      rooms[code] = {
        ...rooms[code],
        ...updates,
        updated_at: new Date().toISOString(),
      };
      await saveRooms(rooms);
      console.log('[DB:local] updateRoom', { code, keys: Object.keys(updates) });
    },

    async createPlayer(id, roomCode, name) {
      const players = await loadPlayers();
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
      players[id] = playerData;
      await savePlayers(players);
      console.log('[DB:local] createPlayer', { id, roomCode });
      return playerData;
    },

    async getPlayer(id) {
      const players = await loadPlayers();
      const player = players[id] || null;
      console.log('[DB:local] getPlayer', { id, found: Boolean(player) });
      return player;
    },

    async updatePlayer(id, updates) {
      const players = await loadPlayers();
      if (!players[id]) {
        console.warn('[DB:local] updatePlayer - player not found', id);
        return;
      }
      players[id] = {
        ...players[id],
        ...updates,
        updated_at: new Date().toISOString(),
      };
      await savePlayers(players);
      console.log('[DB:local] updatePlayer', { id, keys: Object.keys(updates) });
    },

    async getPlayersByRoom(roomCode) {
      try {
        const players = await loadPlayers();
        const roomPlayers = Object.values(players).filter(
          (p) => p.room_code === roomCode && p.is_active
        );
        console.log('[DB:local] getPlayersByRoom', { roomCode, count: roomPlayers.length });
        return roomPlayers;
      } catch (error) {
        console.error('[DB:local] getPlayersByRoom error:', error);
        return [];
      }
    },

    async deletePlayer(id) {
      const players = await loadPlayers();
      delete players[id];
      await savePlayers(players);
      console.log('[DB:local] deletePlayer', { id });
    },
  };

  return adapter;
};

const adapter: DBAdapter = createLocalDBAdapter();

export const db: DBAdapter = adapter;
export type { DBRoom, DBPlayer };
