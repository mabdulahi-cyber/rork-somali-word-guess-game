import { createClient } from '@supabase/supabase-js';
import type { CardType, Team } from '@/types/game';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  if (__DEV__) {
    console.error('[DB] Missing Supabase environment variables');
    console.error('[DB] Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY');
  }
}

export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || '',
  {
    auth: {
      persistSession: false,
    },
  }
);

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
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Game configuration error. Please contact support.');
    }
    
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

    const { data, error } = await supabase
      .from('rooms')
      .insert(roomData)
      .select()
      .single();

    if (error) {
      console.error('[DB] createRoom error:', error);
      throw new Error(error.message);
    }

    return data;
  },

  async getRoom(code: string): Promise<DBRoom | null> {
    
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', code)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('[DB] getRoom error:', error);
      throw new Error(error.message);
    }

    return data;
  },

  async updateRoom(code: string, updates: Partial<DBRoom>): Promise<void> {
    
    const { error } = await supabase
      .from('rooms')
      .update(updates)
      .eq('code', code);

    if (error) {
      console.error('[DB] updateRoom error:', error);
      throw new Error(error.message);
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

    const { data, error } = await supabase
      .from('players')
      .insert(playerData)
      .select()
      .single();

    if (error) {
      console.error('[DB] createPlayer error:', error);
      throw new Error(error.message);
    }

    return data;
  },

  async getPlayer(id: string): Promise<DBPlayer | null> {
    
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('[DB] getPlayer error:', error);
      throw new Error(error.message);
    }

    return data;
  },

  async updatePlayer(id: string, updates: Partial<DBPlayer>): Promise<void> {
    
    const { error } = await supabase
      .from('players')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('[DB] updatePlayer error:', error);
      throw new Error(error.message);
    }
  },

  async getPlayersByRoom(roomCode: string): Promise<DBPlayer[]> {
    
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('room_code', roomCode)
      .eq('is_active', true);

    if (error) {
      console.error('[DB] getPlayersByRoom error:', error);
      throw new Error(error.message);
    }

    return data || [];
  },

  async deletePlayer(id: string): Promise<void> {
    
    const { error } = await supabase
      .from('players')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[DB] deletePlayer error:', error);
      throw new Error(error.message);
    }
  },
};
