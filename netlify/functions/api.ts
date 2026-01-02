import { Handler } from '@netlify/functions';
import app from '../../backend/hono';

export const handler: Handler = async (event, context) => {
  const path = event.path.replace('/.netlify/functions/api', '') || '/';
  const url = new URL(path, `https://${event.headers.host}`);
  
  if (event.queryStringParameters) {
    Object.entries(event.queryStringParameters).forEach(([key, value]) => {
      if (value) url.searchParams.append(key, value);
    });
  }

  const req = new Request(url.toString(), {
    method: event.httpMethod,
    headers: new Headers(event.headers as Record<string, string>),
    body: event.body ? event.body : undefined,
  });

  try {
    const response = await app.fetch(req);
    const body = await response.text();

    return {
      statusCode: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body,
    };
  } catch (error) {
    console.error('[Netlify Function] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
