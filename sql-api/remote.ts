import type { AbstractSql, SqlInput, SqlOutput } from './api.ts';

export function GetRemote(url: string, bearerToken: string): AbstractSql {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`;
  return {
    type: 'remote' as const,
    query: async (input: SqlInput): Promise<SqlOutput> => {
      const response = await fetch(url + '/sql/query', {
        method: 'POST',
        headers,
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        let rb = await response.text();
        console.error(`HTTP error! status: ${response.status} ${url}/sql/query`, rb);
        throw new Error(`HTTP error! status: ${response.status} ${url}/sql/query: ${rb}`);
      }

      return await response.json() as SqlOutput;
    },
    close: () => {} // No-op for remote connections
  };
}
