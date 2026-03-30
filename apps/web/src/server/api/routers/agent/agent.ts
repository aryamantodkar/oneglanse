import {
	getAuthModuleState,
	getAuthProviderCards,
	readProviderAuthStatuses,
	redis,
	spawnProviderAuthLogin,
} from "@oneglanse/services";
import { AUTH_PROVIDER_LIST } from "@oneglanse/types";
import { z } from "zod";
import { createRateLimiter } from "../../middleware/rateLimit";
import {
	authorizedWorkspaceProcedure,
	publicProcedure,
} from "../../procedures";
import { submitAgentRun } from "../_shared/submitAgentRun";
import { createTRPCRouter } from "../../trpc";

export const agentRouter = createTRPCRouter({
	authProviders: publicProcedure.query(async () => {
		const [cards, statuses] = await Promise.all([
			Promise.resolve(getAuthProviderCards()),
			readProviderAuthStatuses(),
		]);
		const statusMap = new Map(
			statuses.map((status) => [status.provider, status] as const),
		);

		return {
			...getAuthModuleState(),
			cards: cards.map((card) => ({
				...card,
				status: statusMap.get(card.provider) ?? {
					provider: card.provider,
					connected: false,
					connecting: false,
					synced: false,
					lastUpdatedAt: null,
					syncedAt: null,
					error: null,
				},
			})),
		};
	}),

	connectProvider: publicProcedure
		.input(z.object({ provider: z.enum(AUTH_PROVIDER_LIST) }))
		.mutation(async ({ input }) => spawnProviderAuthLogin(input.provider)),

	run: authorizedWorkspaceProcedure
		.use(createRateLimiter("agent.run", { limit: 3, windowSecs: 60 }))
		.mutation(async ({ ctx }) => {
			const {
				user: { id: userId },
				workspaceId,
			} = ctx;

			return submitAgentRun({ workspaceId, userId });
		}),

	status: authorizedWorkspaceProcedure
		.input(z.object({ jobId: z.string() }))
		.output(
			z.object({
				status: z.enum(["pending", "completed"]),
				response: z.unknown(),
			}),
		)
		.query(async ({ input }) => {
			const result = await redis.get(`job:${input.jobId}:result`);

			if (!result) {
				return { status: "pending" as const, response: null };
			}

			const parsed = JSON.parse(result);
			return {
				status: parsed?.status === "completed" ? "completed" : "pending",
				response: parsed,
			};
		}),
});
