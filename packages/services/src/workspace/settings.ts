import { db, schema } from "@oneglanse/db";
import type { Workspace } from "@oneglanse/db";
import type { Provider } from "@oneglanse/types";
import { and, eq, isNull } from "drizzle-orm";
import { resetWorkspaceAnalysis } from "../analysis/analysis.js";
import {
	scheduleCronForPrompts,
	unscheduleCronForPrompts,
} from "../prompt/index.js";
import { getWorkspaceById } from "./query.js";

export async function updateWorkspaceDetails(args: {
	workspaceId: string;
	name: string;
	domain: string;
}): Promise<{ workspace: Workspace; analysisReset: boolean }> {
	const { workspaceId, name, domain } = args;
	const nextName = name.trim();
	const nextDomain = domain.trim();

	const current = await getWorkspaceById({ workspaceId });
	const brandChanged =
		current.name.trim() !== nextName || current.domain.trim() !== nextDomain;

	await db
		.update(schema.workspaces)
		.set({ name: nextName, domain: nextDomain })
		.where(
			and(
				eq(schema.workspaces.id, workspaceId),
				isNull(schema.workspaces.deletedAt),
			),
		);

	if (brandChanged) {
		await resetWorkspaceAnalysis({ workspaceId });
	}

	// Build the updated workspace from the pre-update record — avoids a second DB roundtrip
	const workspace = { ...current, name: nextName, domain: nextDomain };
	return { workspace, analysisReset: brandChanged };
}

export async function updateOrganizationName(args: {
	workspaceId: string;
	organizationName: string;
}) {
	const { workspaceId, organizationName } = args;
	const workspace = await getWorkspaceById({ workspaceId });

	const baseSlug =
		organizationName
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "") || "organization";

	// Workspace-scoped slug key prevents cross-workspace collisions for identical brand/org names.
	const workspaceKey = workspace.id.toLowerCase() || "workspace";
	const nextSlug = `${baseSlug}-${workspaceKey}`;

	await db
		.update(schema.organization)
		.set({ name: organizationName.trim(), slug: nextSlug })
		.where(eq(schema.organization.id, workspace.tenantId));

	return db.query.organization.findFirst({
		where: eq(schema.organization.id, workspace.tenantId),
	});
}

export async function setWorkspaceEnabledProviders(args: {
	workspaceId: string;
	providers: Provider[];
}): Promise<{ providers: Provider[] }> {
	const { workspaceId, providers } = args;
	await db
		.update(schema.workspaces)
		.set({ enabledProviders: JSON.stringify(providers) })
		.where(eq(schema.workspaces.id, workspaceId));
	return { providers };
}

export async function updateWorkspaceSchedule(args: {
	workspaceId: string;
	userId: string;
	schedule: string | null;
}): Promise<{ schedule: string | null }> {
	const { workspaceId, userId, schedule } = args;

	await db
		.update(schema.workspaces)
		.set({ schedule })
		.where(eq(schema.workspaces.id, workspaceId));

	// pg_cron setup is best-effort — a failure here must not prevent the
	// caller from running an immediate job or returning a success response.
	try {
		if (schedule) {
			await scheduleCronForPrompts({
				workspaceId,
				userId,
				cronExpression: schedule,
			});
		} else {
			await unscheduleCronForPrompts({ workspaceId });
		}
	} catch (err) {
		console.warn(
			"[workspace] pg_cron schedule update failed (non-fatal):",
			err,
		);
	}

	return { schedule };
}
