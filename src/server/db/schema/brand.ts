import { pgTable, varchar, text, timestamp, integer, numeric, unique, json } from "drizzle-orm/pg-core";
import { workspaces } from "./workspace";
import type { Competitor } from "../types";

export const brands = pgTable("brands", {
  id: varchar("id", { length: 256 }).primaryKey(),
  workspaceId: varchar("workspace_id", { length: 256 })
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 256 }).notNull(),
  slug: varchar("slug", { length: 256 }),
  website: varchar("website", { length: 512 }),
  logoUrl: varchar("logo_url", { length: 512 }),
  description: text("description"),
  industry: varchar("industry", { length: 128 }),
  competitors: json("competitors").$type<Competitor[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  unique("unique_workspace_brand").on(t.workspaceId),
]);