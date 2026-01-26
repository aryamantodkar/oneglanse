import { getDb, getClickhouse, getPgPool } from "@onescope/db";

export function db() {
  return getDb();
}

export function clickhouse() {
  return getClickhouse();
}

export function pgPool() {
  return getPgPool();
}