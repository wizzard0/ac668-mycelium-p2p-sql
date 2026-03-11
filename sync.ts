import {AbstractSql} from "./sql-api/api.ts";

export interface Sequences {
  [node: string]: number;
}

// step 1 of 4
export async function GetSequences(target:AbstractSql,table:string):Promise<Sequences> {
  let res = await target.query({sql: `SELECT node, max(seq) as seq FROM ${table} GROUP BY node`, params: []});
  let sequences:Sequences = {};
  for (let row of res.rows) {
    sequences[row[0]] = row[1];
  }
  return sequences;
}

export interface SequenceRange {
  node: string;
  start: number;
  end: number;
  direction: 'source_to_target' | 'target_to_source';
}

// step 2 of 4
export async function GetSequencesToSync(source: AbstractSql, target: AbstractSql,table:string): Promise<SequenceRange[]> {
  const sourceSequences = await GetSequences(source,table);
  const targetSequences = await GetSequences(target,table);

  const rangesToSync: SequenceRange[] = [];
  const directions: ('source_to_target' | 'target_to_source')[] = ['source_to_target', 'target_to_source'];

  for (const direction of directions) {
    const [fromSequences, toSequences] = direction === 'source_to_target' 
      ? [sourceSequences, targetSequences] 
      : [targetSequences, sourceSequences];

    for (const node in fromSequences) {
      const fromSeq = fromSequences[node];
      const toSeq = toSequences[node] || 0;

      if (fromSeq > toSeq) {
        rangesToSync.push({
          node,
          start: toSeq + 1,
          end: fromSeq,
          direction
        });
      }
    }
  }

  return rangesToSync;
}

