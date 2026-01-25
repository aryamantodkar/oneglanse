import "server-only";

export function formatDateToClickHouse(dt: Date) {
    return dt.toISOString().slice(0, 19).replace("T", " "); 
  }