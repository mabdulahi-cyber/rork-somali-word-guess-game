const getConfig = () => {
  const endpoint = process.env.EXPO_PUBLIC_RORK_DB_ENDPOINT;
  const namespace = process.env.EXPO_PUBLIC_RORK_DB_NAMESPACE;
  const token = process.env.EXPO_PUBLIC_RORK_DB_TOKEN;

  console.log('[Backend:DB] Environment check:', {
    hasEndpoint: !!endpoint,
    hasNamespace: !!namespace,
    hasToken: !!token,
    nodeEnv: process.env.NODE_ENV,
  });

  if (!endpoint || !namespace || !token) {
    console.error('[Backend:DB] Missing configuration:', { 
      hasEndpoint: !!endpoint, 
      hasNamespace: !!namespace, 
      hasToken: !!token 
    });
    throw new Error('Database not configured. This app requires Rork system environment variables and cannot run in external deployments like Netlify.');
  }

  return { endpoint, namespace, token };
};

export const queryDB = async <T = unknown>(query: string, vars?: Record<string, unknown>): Promise<T[]> => {
  const { endpoint, namespace, token } = getConfig();
  
  const baseEndpoint = endpoint.replace(/\/rpc$/, '').replace(/\/$/, '');
  const sqlEndpoint = baseEndpoint + '/sql';
  
  console.log('[Backend:DB] Executing query:', query.substring(0, 100));
  console.log('[Backend:DB] Endpoint:', sqlEndpoint);
  
  let queryBody: string;
  if (vars && Object.keys(vars).length > 0) {
    let processedQuery = query;
    for (const [key, value] of Object.entries(vars)) {
      const jsonValue = JSON.stringify(value);
      const placeholder = '$' + key;
      processedQuery = processedQuery.replace(new RegExp('\\' + placeholder, 'g'), jsonValue);
    }
    queryBody = processedQuery;
  } else {
    queryBody = query;
  }
  
  console.log('[Backend:DB] Processed query:', queryBody.substring(0, 200));
  
  try {
    const response = await fetch(sqlEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Surreal-NS': namespace,
        'Surreal-DB': 'default',
      },
      body: queryBody,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Backend:DB] HTTP Error:', response.status, errorText);
      throw new Error(`Database HTTP error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('[Backend:DB] Response received:', JSON.stringify(data).substring(0, 200));

    if (Array.isArray(data)) {
      if (data.length > 0 && data[0].result !== undefined) {
        const result = data[0].result;
        return Array.isArray(result) ? result : (result ? [result] : []);
      }
      return data as T[];
    }

    if (data && typeof data === 'object') {
      if (data.result !== undefined) {
        const result = data.result;
        return Array.isArray(result) ? result : (result ? [result] : []);
      }
      if (data.error) {
        console.error('[Backend:DB] Query error:', data.error);
        throw new Error(`Database query error: ${JSON.stringify(data.error)}`);
      }
    }

    return [];
  } catch (error) {
    console.error('[Backend:DB] Query failed:', error);
    throw error;
  }
};
