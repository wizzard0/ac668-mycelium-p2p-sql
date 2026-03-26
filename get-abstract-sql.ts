import type {AbstractSql} from "./sql-api/api.ts";
import {BunSqlApi} from "./sql-api/bun.ts";
import {GetRemote} from "./sql-api/remote.ts";

export function getAbstractSql(source: string): AbstractSql {
  if (false){
    console.log("GetAbstract sql source: " + source);
  }
  if (source.endsWith('.db')) {
    return new BunSqlApi(source);
  } else if (source.match(/:\d+$/)) {
    let url = source.includes('://') ? source : ('http://' + source)
    return GetRemote(url, "");
  } else {
    throw new Error(`Invalid source: ${source}. Must end with .db or :<port>`);
  }
}
