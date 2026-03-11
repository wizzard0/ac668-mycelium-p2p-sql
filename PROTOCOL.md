# mycelium-p2p-sql HTTP Protocol

Single endpoint. All SQL goes through `POST /sql/query`.

## Request

```
POST /sql/query
Content-Type: application/json
```

Body:

```json
{
  "sql": "SELECT node, seq FROM example WHERE node = ? AND seq >= ?",
  "params": ["node1", 1]
}
```

| Field    | Type     | Description                                      |
|----------|----------|--------------------------------------------------|
| `sql`    | `string` | SQL statement with `?` positional placeholders   |
| `params` | `any[]`  | Bind values, one per `?`, in order. `[]` if none |

Parameters are bound positionally — first `?` gets `params[0]`, etc. Named parameters (`:name`, `@name`) are not used.

## Response (success)

```
200 OK
Content-Type: application/json
```

```json
{
  "rows": [[1, "hello"], [2, "world"]],
  "fields": [{"name": "seq"}, {"name": "data"}]
}
```

| Field    | Type                     | Description                           |
|----------|--------------------------|---------------------------------------|
| `rows`   | `any[][]`                | Array of rows; each row is an array of column values in field order |
| `fields` | `{ name: string }[]`     | Column metadata, one entry per column |

Rows are arrays of values (not objects). Column order matches `fields` order.

## Response (error)

```
500 Internal Server Error
Content-Type: application/json
```

```json
{
  "error": "no such table: missing_table"
}
```

## Example

```bash
curl -X POST http://localhost:3000/sql/query \
  -H 'Content-Type: application/json' \
  -d '{"sql": "SELECT 1 as data", "params": []}'
```

```json
{
  "rows": [[1]],
  "fields": [{"name": "data"}]
}
```

## LWW (Last-Writer-Wins) Query API

Tables use the syncable schema `(node, seq, oid, time, data)` where `time` is unix ms. Multiple writes to the same `oid` are resolved by `MAX(time)`.

### TypeScript API

```ts
import { queryLWWByOid, queryLWW } from "mycelium-p2p-sql/lww";

// latest state of a single object
const record = await queryLWWByOid(db, "my_table", "object-id-123");
// => { node, seq, oid, time, data } or null

// latest state of all objects, no filter
const all = await queryLWW(db, "my_table", {});

// latest state filtered by JSON fields in data column
const activeUsers = await queryLWW(db, "my_table", { type: "user", state: "active" });
```

`exactArgs` filters use `json_extract(data, '$.key') = ?` — applied after LWW resolution, so only the latest version of each object is tested.

### Equivalent SQL

Single oid:

```sql
SELECT node, seq, oid, time, data FROM my_table
WHERE oid = ? ORDER BY time DESC LIMIT 1
```

All oids with JSON filter:

```sql
SELECT node, seq, oid, time, data FROM my_table
WHERE (oid, time) IN (SELECT oid, MAX(time) FROM my_table GROUP BY oid)
  AND json_extract(data, '$.type') = ?
  AND json_extract(data, '$.state') = ?
```

## Notes

- CORS is enabled for all origins.
- No authentication in the current protocol (the server trusts its network boundary).
- DDL statements (`CREATE TABLE`, etc.) use the same endpoint — there is no separate schema API.
- The server runs SQLite; all SQL dialect is SQLite SQL.
