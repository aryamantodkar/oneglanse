import { sql } from "drizzle-orm";
import {
	index,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import z from "zod";
import { user } from "./auth.js";

// Keep in sync with PROVIDER_LIST in @oneglanse/types
const DEFAULT_PROVIDERS_JSON =
	'["chatgpt","claude","perplexity","gemini","ai-overview"]';

export const workspaces = pgTable("workspaces", {
	id: varchar("id", { length: 256 }).primaryKey(),
	name: varchar("name", { length: 256 }).notNull(),
	slug: varchar("slug", { length: 256 }).notNull(),
	domain: varchar("domain", { length: 256 }).notNull(),
	tenantId: varchar("tenant_id", { length: 256 }).notNull(),
	country: varchar("country", { length: 64 }).notNull(),
	region: varchar("region", { length: 128 }),
	schedule: varchar("schedule", { length: 64 }),
	enabledProviders: text("enabled_providers")
		.default(DEFAULT_PROVIDERS_JSON)
		.notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	deletedAt: timestamp("deleted_at"),
});

export const workspaceMembers = pgTable(
	"workspace_members",
	{
		id: uuid("id").defaultRandom().primaryKey(),

		workspaceId: text("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),

		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),

		role: text("role").notNull().default("member"),

		createdAt: timestamp("created_at").defaultNow().notNull(),
		deletedAt: timestamp("deleted_at"),
	},
	(table) => ({
		uniqueActiveMember: uniqueIndex("workspace_members_unique_active")
			.on(table.workspaceId, table.userId)
			.where(sql`${table.deletedAt} IS NULL`),

		workspaceIdx: index("workspace_members_workspace_id_idx").on(
			table.workspaceId,
		),
		userIdx: index("workspace_members_user_id_idx").on(table.userId),
	}),
);

export const workspaceInput = z.object({
	workspaceId: z.string(),
});
