import "server-only";

import {
  pgTable,
  uuid,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { workspaces } from "./workspace";

export const competitors = pgTable(
  "competitors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    domain: text("domain"),
    source: text("source").notNull(),
    status: text("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceDomainUnique: uniqueIndex(
      "competitors_workspace_domain_unique"
    ).on(table.workspaceId, table.domain),
  })
);