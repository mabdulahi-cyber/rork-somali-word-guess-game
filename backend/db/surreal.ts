import { Surreal } from 'surrealdb';

let db: Surreal | null = null;

export const getDB = async (): Promise<Surreal> => {
  if (db) return db;

  const endpoint = process.env.EXPO_PUBLIC_RORK_DB_ENDPOINT;
  const namespace = process.env.EXPO_PUBLIC_RORK_DB_NAMESPACE;
  const token = process.env.EXPO_PUBLIC_RORK_DB_TOKEN;

  if (!endpoint || !namespace || !token) {
    throw new Error('Missing database configuration');
  }

  db = new Surreal();
  
  await db.connect(endpoint, {
    namespace,
    database: 'default',
  });

  await db.authenticate(token);

  console.log('[Backend] SurrealDB connected');
  return db;
};

export const queryDB = async <T = unknown>(query: string, vars?: Record<string, unknown>): Promise<T[]> => {
  const db = await getDB();
  const results = await db.query(query, vars);
  
  if (!results || results.length === 0) {
    return [];
  }
  
  return results[0] as T[];
};
