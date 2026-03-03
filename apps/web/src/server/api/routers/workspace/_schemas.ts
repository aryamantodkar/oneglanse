import { PROVIDER_LIST, type Provider } from "@oneglanse/types";
import { z } from "zod";

export const createWorkspaceInputSchema = z.object({
	organizationName: z.string().min(2).max(80).optional(),
	name: z.string().min(2).max(50),
	slug: z.string().min(2).max(50),
	domain: z.string().min(2).max(50),
});

export const listByOrgInputSchema = z.object({ tenantId: z.string().min(1) });

export const createInOrgInputSchema = z.object({
	name: z.string().min(2).max(50),
	slug: z.string().min(2).max(50),
	domain: z.string().min(2).max(256),
	tenantId: z.string().min(1),
});

export const updateDetailsInputSchema = z.object({
	workspaceId: z.string().min(1),
	name: z.string().min(2).max(80),
	domain: z.string().min(2).max(256),
});

export const updateOrganizationNameInputSchema = z.object({
	workspaceId: z.string().min(1),
	organizationName: z.string().min(2).max(80),
});

export const addMemberInputSchema = z.object({
	email: z.string().email(),
	role: z.enum(["owner", "member"]).default("member"),
});

export const joinByCodeInputSchema = z.object({ code: z.string().min(1) });

export const removeMemberInputSchema = z.object({
	userId: z.string().min(1),
	role: z.string().min(1),
});

export const setEnabledProvidersInputSchema = z.object({
	providers: z
		.array(z.enum([...PROVIDER_LIST] as [Provider, ...Provider[]]))
		.min(1, "At least one provider must be enabled"),
});

export const setScheduleInputSchema = z.object({
	schedule: z.string().nullable(),
});
