import { Handler } from '@netlify/functions';
import app from '../../backend/hono';

export const handler: Handler = async (event, context) => {
  let path = event.path || '/';
  
  console.log('[Netlify Function] Original path:', path);
  console.log('[Netlify Function] Method:', event.httpMethod);
  
  const url = new URL(path, `https://${event.headers.host || 'localhost'}`);
  
  if (event.queryStringParameters) {
    Object.entries(event.queryStringParameters).forEach(([key, value]) => {
      if (value) url.searchParams.append(key, value);
    });
  }
  
  console.log('[Netlify Function] Full URL:', url.toString());

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
