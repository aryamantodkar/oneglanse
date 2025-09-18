import { randomUUID } from "crypto"; // built-in in Node.js

export function newId(prefix: string) {
  return `${prefix}_${randomUUID()}`;
}