import { pgTable, text, timestamp, boolean, varchar } from "drizzle-orm/pg-core";

export const workspaces = pgTable("workspaces", {
    id: varchar("id", { length: 256 }).primaryKey(),
    name: varchar("name", { length: 256 }).notNull(),
    slug: varchar("slug", { length: 256 }).notNull(),
    domain: varchar("domain", { length: 256 }).notNull(),
    tenantId: varchar("tenant_id", { length: 256 }).notNull(),
    country: varchar("country", { length: 64 }).notNull(), 
    region: varchar("region", { length: 128 }),             
    createdAt: timestamp("created_at").notNull(),
    deletedAt: timestamp("deleted_at"),
});