import Surreal from 'surrealdb.js';
import type { CardType, Team } from '@/types/game';

type NormalizedDbError = {
  name?: string;
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

const resolveEnv = (key: string): string | undefined => {
  const env = (globalThis as any)?.process?.env as Record<string, string | undefined> | undefined;
  return env?.[key];
};

const normalizeUnknownError = (error: unknown): NormalizedDbError => {
  if (error && typeof error === 'object') {
    const anyErr = error as any;
    const message =
      (typeof anyErr?.message === 'string' && anyErr.message) ||
      (typeof anyErr?.toString === 'function' ? String(anyErr.toString()) : 'Unknown error');

    return {
      name: typeof anyErr?.name === 'string' ? anyErr.name : undefined,
      message,
      code: typeof anyErr?.code === 'string' ? anyErr.code : undefined,
      details: typeof anyErr?.details === 'string' ? anyErr.details : undefined,
      hint: typeof anyErr?.hint === 'string' ? anyErr.hint : undefined,
    };
  }

  if (typeof error === 'string') return { message: error };
  return { message: 'Unknown error' };
};



const preflightHttpEndpoint = async (endpoint: string): Promise<void> => {
  if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) return;

  try {
    const resp = await fetch(endpoint, { method: 'GET' });
    const ct = resp.headers.get('content-type') ?? '';

    if (!resp.ok) {
      const body = await resp.text();
      console.error('[DB] Endpoint preflight non-OK response', {
        status: resp.status,
        contentType: ct,
        bodyPreview: body.slice(0, 160),
      });

      throw new Error(
        `[DB] Database endpoint responded with HTTP ${resp.status}. Please verify EXPO_PUBLIC_RORK_DB_ENDPOINT (it must point to SurrealDB, not your frontend host).`,
      );
    }

    if (ct.includes('text/html')) {
      const body = await resp.text();
      console.error('[DB] Endpoint preflight returned HTML', { bodyPreview: body.slice(0, 160) });
      throw new Error(
        '[DB] Database endpoint appears to be an HTML page (likely a frontend host / 404). Please verify EXPO_PUBLIC_RORK_DB_ENDPOINT points to the database RPC endpoint.',
      );
    }
  } catch (error) {
    const e = normalizeUnknownError(error);
    console.error('[DB] Endpoint preflight failed:', e.message);
    console.error('[DB] Preflight error details:', JSON.stringify(e, null, 2));
    throw new Error(e.message);
  }
};

let _db: Surreal | null = null;
let _connectPromise: Promise<Surreal> | null = null;

export const getDB = async (): Promise<Surreal> => {
  if (_db) return _db;
  if (_connectPromise) return _connectPromise;

  const endpoint = resolveEnv('EXPO_PUBLIC_RORK_DB_ENDPOINT');
  const namespace = resolveEnv('EXPO_PUBLIC_RORK_DB_NAMESPACE');
  const token = resolveEnv('EXPO_PUBLIC_RORK_DB_TOKEN');

  console.log('[DB] Environment check:', {
    hasEndpoint: !!endpoint,
    hasNamespace: !!namespace,
    hasToken: !!token,
    endpointPreview: endpoint ? `${endpoint.slice(0, 80)}...` : null,
  });

  if (!endpoint || !namespace || !token) {
    const missing: string[] = [];
    if (!endpoint) missing.push('EXPO_PUBLIC_RORK_DB_ENDPOINT');
    if (!namespace) missing.push('EXPO_PUBLIC_RORK_DB_NAMESPACE');
    if (!token) missing.push('EXPO_PUBLIC_RORK_DB_TOKEN');
    throw new Error(`[DB] Missing environment variables: ${missing.join(', ')}`);
  }

  _connectPromise = (async () => {
    const instance = new Surreal();

    try {
      console.log('[DB] Preflighting endpoint (http only)');
      await preflightHttpEndpoint(endpoint);

      console.log('[DB] Connecting to SurrealDB…');
      await instance.connect(endpoint, {
        namespace,
        database: 'rork',
      });

      console.log('[DB] Authenticating…');
      await instance.authenticate(token);

      console.log('[DB] Connected + authenticated');
      _db = instance;
      return instance;
    } catch (error) {
      const e = normalizeUnknownError(error);
      console.error('[DB] Connection failed:', e.message);
      console.error('[DB] Error details:', JSON.stringify({
        message: e.message,
        code: e.code,
        details: e.details,
        hint: e.hint,
        name: e.name,
        rawError: error,
      }, null, 2));

      _db = null;
      throw new Error(e.message);
    } finally {
      _connectPromise = null;
    }
  })();

  return _connectPromise;
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
