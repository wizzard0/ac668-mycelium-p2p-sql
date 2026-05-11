import type { AbstractSql, SqlInput, SqlOutput } from './api.ts';

export type RemoteRequestLog = (method: string, url: string, status: number, ms: number, verb: string) => void;
const noop: RemoteRequestLog = () => {};

export function GetRemote(url: string, bearerToken: string, onRequest: RemoteRequestLog = noop): AbstractSql {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`;
  return {
    type: 'remote' as const,
    query: async (input: SqlInput): Promise<SqlOutput> => {
      const start = performance.now();
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

      const result = await response.json() as SqlOutput;
      const ms = Math.round(performance.now() - start);
      const verb = input.sql.trimStart().slice(0, 6).toUpperCase();
      onRequest("POST", url + '/sql/query', response.status, ms, verb);
      return result;
    },
    close: () => {}
  };
}
