import { createClient, type Client } from "@libsql/client";
import fs from "fs";
import path from "path";

export type BindValue = string | number | bigint | null | Uint8Array | boolean;

export interface RunResult {
  lastInsertRowid: number;
  changes: number;
}

export interface PreparedStatement {
  run(...args: BindValue[]): Promise<RunResult>;
  get(...args: BindValue[]): Promise<Record<string, unknown> | undefined>;
  all(...args: BindValue[]): Promise<Record<string, unknown>[]>;
}

export interface DbClient {
  prepare(sql: string): PreparedStatement;
  exec(sql: string): Promise<void>;
  execute(sql: string, args?: BindValue[]): Promise<void>;
}

function createPreparedStatement(
  client: Client,
  sql: string
): PreparedStatement {
  return {
    async run(...args: BindValue[]) {
      const result = await client.execute({ sql, args });
      return {
        lastInsertRowid: Number(result.lastInsertRowid ?? 0),
        changes: result.rowsAffected,
      };
    },
    async get(...args: BindValue[]) {
      const result = await client.execute({ sql, args });
      return result.rows[0] as Record<string, unknown> | undefined;
    },
    async all(...args: BindValue[]) {
      const result = await client.execute({ sql, args });
      return result.rows as Record<string, unknown>[];
    },
  };
}

export function createDbClient(client: Client): DbClient {
  return {
    prepare(sql: string) {
      return createPreparedStatement(client, sql);
    },
    async exec(sql: string) {
      await client.executeMultiple(sql);
    },
    async execute(sql: string, args: BindValue[] = []) {
      await client.execute({ sql, args });
    },
  };
}

const defaultDbPath = path.join(process.cwd(), "data", "grand-holdings.db");

export function resolveDatabaseUrl(): string {
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  if (tursoUrl) return tursoUrl;

  const dir = path.dirname(defaultDbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return `file:${defaultDbPath}`;
}

export function createLibsqlClient(): Client {
  const url = resolveDatabaseUrl();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();

  return createClient({
    url,
    ...(authToken ? { authToken } : {}),
  });
}

export function isTursoProduction(): boolean {
  return Boolean(process.env.TURSO_DATABASE_URL?.trim());
}
