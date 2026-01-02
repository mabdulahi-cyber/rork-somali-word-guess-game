import { Hono } from 'hono';
import { cors } from 'hono/cors';
import tablesRouter from './routes/tables';

const app = new Hono();

app.use('*', cors());

app.get('/health', (c) => {
  return c.json({ 
    status: 'ok', 
    message: 'Somali Codenames API is running',
    timestamp: new Date().toISOString(),
    env: {
      hasEndpoint: !!process.env.EXPO_PUBLIC_RORK_DB_ENDPOINT,
      hasNamespace: !!process.env.EXPO_PUBLIC_RORK_DB_NAMESPACE,
      hasToken: !!process.env.EXPO_PUBLIC_RORK_DB_TOKEN,
    }
  });
});

app.route('/api/tables', tablesRouter);

app.get('/', (c) => {
  return c.json({ status: 'ok', message: 'Somali Codenames API is running' });
});

app.get('/api', (c) => {
  return c.json({ status: 'ok', message: 'Somali Codenames API is running at /api' });
});

app.notFound((c) => {
  console.log('[Hono] 404 Not Found:', c.req.url);
  return c.json({ error: 'Not found', path: c.req.url }, 404);
});

export default app;
