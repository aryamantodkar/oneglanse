import { pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
export const workspaces = pgTable("workspaces", {
    id: varchar("id", { length: 256 }).primaryKey(),
    name: varchar("name", { length: 256 }).notNull(),
    slug: varchar("slug", { length: 256 }).notNull(),
    tenantId: varchar("tenant_id", { length: 256 }).notNull(),
    createdAt: timestamp("created_at").notNull(),
    deletedAt: timestamp("deleted_at"),
});
