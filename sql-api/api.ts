// base sql api

export interface AbstractSql {
  query: (x: SqlInput) => Promise<SqlOutput>;
  type: 'file' | 'remote';
  close: () => void;
}

export interface SqlInput {
  sql: string;
  params: any[];
}

export interface SqlOutput {
  rows: any[];
  fields: any[];
}

export function MockApi(): AbstractSql {
  return {
    query: async (x: SqlInput): Promise<SqlOutput> => {
      return { rows: [[1]], fields: [{ name: 'column1' }] };
    },
    type: 'file',
    close: () => {}
  };
}

// sync types

export interface SyncableRecord {
  node: string;
  seq: number;
  oid: string;
  time: number; // unix ms
}

