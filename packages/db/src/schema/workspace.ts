import { sql } from "drizzle-orm";
import {
	index,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import z from "zod";
import { user } from "./auth.js";

export const workspaceEnabledProviderEnum = pgEnum(
	"workspace_enabled_provider",
	["chatgpt", "perplexity", "gemini", "google", "claude"],
);

export const workspaces = pgTable("workspaces", {
	id: varchar("id", { length: 256 }).primaryKey(),
	name: varchar("name", { length: 256 }).notNull(),
	slug: varchar("slug", { length: 256 }).notNull(),
	domain: varchar("domain", { length: 256 }).notNull(),
	tenantId: varchar("tenant_id", { length: 256 }).notNull(),
	schedule: varchar("schedule", { length: 64 }),
	enabledProviders: workspaceEnabledProviderEnum("enabled_providers").array(),
	selectedPromptIds: text("selected_prompt_ids").array(),
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
