const TABLE_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]{0,255}$/;

export function validateTableName(table: string): void {
  if (!TABLE_NAME_RE.test(table)) {
    throw new Error(
      `Invalid table name: ${JSON.stringify(table)}. ` +
      "Must match /^[a-zA-Z_][a-zA-Z0-9_]{0,255}$/."
    );
  }
}
