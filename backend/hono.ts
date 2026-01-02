import { Hono } from 'hono';
import { cors } from 'hono/cors';
import tablesRouter from './routes/tables';

const app = new Hono();

app.use('*', cors());

app.route('/api/tables', tablesRouter);

app.get('/', (c) => {
  return c.json({ status: 'ok', message: 'Somali Codenames API is running' });
});

export default app;
