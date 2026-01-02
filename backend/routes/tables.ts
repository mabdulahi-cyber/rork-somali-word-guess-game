import { Hono } from 'hono';
import { queryDB } from '../db/surreal';

const app = new Hono();

interface DBRoom {
  id?: string;
  code: string;
  words: string[];
  key_map: string[];
  revealed: boolean[];
  turn_team: string;
  turn_status: string;
  game_status: string;
  hint_word?: string;
  hint_number?: number;
  guesses_left: number;
  winner_team?: string;
  version: number;
  created_at?: string;
  updated_at?: string;
}

interface DBPlayer {
  id: string;
  room_code: string;
  name: string;
  team: string | null;
  role: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

app.post('/rooms/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<DBRoom>();
  
  try {
    const result = await queryDB<DBRoom>(
      `CREATE rooms:${id} CONTENT $data`,
      { data: body }
    );
    
    return c.json(result[0] || body);
  } catch (error: any) {
    console.error('[Backend] Create room error:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.get('/rooms/:id', async (c) => {
  const id = c.req.param('id');
  
  try {
    const result = await queryDB<DBRoom>(`SELECT * FROM rooms:${id}`);
    
    if (!result || result.length === 0) {
      return c.json(null, 404);
    }
    
    return c.json(result[0]);
  } catch (error: any) {
    console.error('[Backend] Get room error:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.patch('/rooms/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  
  try {
    const result = await queryDB<DBRoom>(
      `UPDATE rooms:${id} MERGE $updates`,
      { updates: body }
    );
    
    return c.json(result[0] || {});
  } catch (error: any) {
    console.error('[Backend] Update room error:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.post('/players/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<DBPlayer>();
  
  try {
    const result = await queryDB<DBPlayer>(
      `CREATE players:${id} CONTENT $data`,
      { data: body }
    );
    
    return c.json(result[0] || body);
  } catch (error: any) {
    console.error('[Backend] Create player error:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.get('/players/:id', async (c) => {
  const id = c.req.param('id');
  
  try {
    const result = await queryDB<DBPlayer>(`SELECT * FROM players:${id}`);
    
    if (!result || result.length === 0) {
      return c.json(null, 404);
    }
    
    return c.json(result[0]);
  } catch (error: any) {
    console.error('[Backend] Get player error:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.patch('/players/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  
  try {
    const result = await queryDB<DBPlayer>(
      `UPDATE players:${id} MERGE $updates`,
      { updates: body }
    );
    
    return c.json(result[0] || {});
  } catch (error: any) {
    console.error('[Backend] Update player error:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.delete('/players/:id', async (c) => {
  const id = c.req.param('id');
  
  try {
    await queryDB(`DELETE players:${id}`);
    return c.json({ success: true });
  } catch (error: any) {
    console.error('[Backend] Delete player error:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.get('/players', async (c) => {
  const roomCode = c.req.query('room_code');
  const isActive = c.req.query('is_active');
  
  try {
    let query = 'SELECT * FROM players';
    const conditions: string[] = [];
    
    if (roomCode) {
      conditions.push(`room_code = '${roomCode}'`);
    }
    
    if (isActive) {
      conditions.push(`is_active = ${isActive === 'true'}`);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    const result = await queryDB<DBPlayer>(query);
    return c.json(result || []);
  } catch (error: any) {
    console.error('[Backend] Get players error:', error);
    return c.json({ error: error.message }, 500);
  }
});

export default app;
