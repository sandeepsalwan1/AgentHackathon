import postgres from "postgres";

export class MissingDatabaseUrlError extends Error {
  constructor() {
    super("DATABASE_URL or POSTGRES_URL is required.");
    this.name = "MissingDatabaseUrlError";
  }
}

let cachedSql: postgres.Sql | null = null;

function databaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
}

function shouldUseSsl(url: string) {
  if (url.includes("sslmode=disable")) return false;
  return !url.includes("localhost") && !url.includes("127.0.0.1");
}

export function getSql() {
  const url = databaseUrl();
  if (!url) throw new MissingDatabaseUrlError();
  if (!cachedSql) {
    cachedSql = postgres(url, {
      max: 1,
      ssl: shouldUseSsl(url) ? "require" : false,
      idle_timeout: 5,
      connect_timeout: 10
    });
  }
  return cachedSql;
}

export function hasDatabaseUrl() {
  return Boolean(databaseUrl());
}
