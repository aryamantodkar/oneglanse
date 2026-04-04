"use client";

import {
	formFieldClassName,
	formHintClassName,
	formLabelClassName,
	formPanelClassName,
	formPrimaryButtonClassName,
	formSecondaryButtonClassName,
} from "@/components/forms/auth-form-chrome";
import { authClient } from "@/lib/auth/auth-client";
import { api } from "@/trpc/react";
import {
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Input,
	Label,
	toast,
} from "@oneglanse/ui";
import { cn } from "@oneglanse/utils";
import { ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type JoinSelection = {
	organization: { id: string; name: string; slug: string | null };
	workspaces: { id: string; name: string; slug: string }[];
};

export default function WorkspaceGateway() {
	const router = useRouter();
	const [code, setCode] = useState("");
	const [selection, setSelection] = useState<JoinSelection | null>(null);

	const joinMutation = api.workspace.joinByCode.useMutation();

	const handleJoin = async (joinCode: string) => {
		if (!joinCode.trim()) {
			toast.error("Please enter a workspace code.");
			return;
		}

		setSelection(null);

		try {
			const result = await joinMutation.mutateAsync({ code: joinCode.trim() });
			if (result.status === "select-workspace") {
				setSelection({
					organization: result.organization,
					workspaces: result.workspaces,
				});
				return;
			}

			const { workspace, organization } = result;
			await authClient.organization.setActive({
				organizationId: organization.id,
				organizationSlug: organization.slug ?? undefined,
			});
			router.refresh();
			router.push(`/dashboard?workspace=${workspace.id}`);
		} catch (err) {
			console.error(err);
			toast.error("Unable to join workspace.");
		}
	};

	const handleSelectWorkspace = async (workspaceSlug: string) => {
		if (!selection) return;
		const orgCode = selection.organization.slug ?? selection.organization.id;
		await handleJoin(`${orgCode}/${workspaceSlug}`);
	};

	return (
		<div className="flex min-h-svh min-w-0 items-center justify-center bg-stone-50 px-4 py-6 dark:bg-neutral-950 sm:px-6 sm:py-8">
			<div className="ui-stagger w-full max-w-4xl space-y-8">
				<div className="space-y-3 text-center">
					<h1 className="text-[2rem] font-semibold tracking-[-0.05em] text-gray-950 dark:text-gray-50">
						Workspace setup
					</h1>
					<p className="mx-auto max-w-2xl text-sm text-gray-600 dark:text-gray-300">
						Join an existing workspace with a code, or create a new one.
					</p>
				</div>

				<div className="grid grid-cols-1 gap-5 md:grid-cols-2">
					<Card className={formPanelClassName}>
						<CardHeader className="space-y-2 px-6 pt-6 pb-0 sm:px-7 sm:pt-7">
							<CardTitle className="text-[1.4rem] tracking-[-0.04em]">
								Join Workspace
							</CardTitle>
							<CardDescription>
								Enter a workspace code shared by your team.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-5 px-6 py-6 sm:px-7 sm:py-7">
							<div className="space-y-2.5">
								<Label htmlFor="join-code" className={formLabelClassName}>
									Workspace Code
								</Label>
								<Input
									id="join-code"
									placeholder="acme/marketing"
									value={code}
									onChange={(e) => setCode(e.target.value)}
									onKeyDown={(e) => e.key === "Enter" && handleJoin(code)}
									className={formFieldClassName}
								/>
							</div>

							{selection && (
								<div className="space-y-3 rounded-[24px] border border-dashed border-gray-200/80 bg-stone-50/80 p-4 dark:border-gray-800 dark:bg-gray-900/60">
									<p className="text-sm text-gray-600 dark:text-gray-300">
										Select a workspace in{" "}
										<strong>{selection.organization.name}</strong>
									</p>
									<div className="flex flex-wrap gap-2">
										{selection.workspaces.map((ws) => (
											<Button
												key={ws.id}
												variant="outline"
												size="sm"
												onClick={() => handleSelectWorkspace(ws.slug)}
												className={cn(
													formSecondaryButtonClassName,
													"h-9 rounded-xl px-3",
												)}
											>
												{ws.name}
											</Button>
										))}
									</div>
								</div>
							)}

							<Button
								onClick={() => handleJoin(code)}
								disabled={joinMutation.isPending || !code.trim()}
								className={cn(formPrimaryButtonClassName, "gap-2")}
							>
								{joinMutation.isPending ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<>
										Join Workspace
										<ArrowRight className="h-4 w-4" />
									</>
								)}
							</Button>
						</CardContent>
					</Card>

					<Card className={formPanelClassName}>
						<CardHeader className="space-y-2 px-6 pt-6 pb-0 sm:px-7 sm:pt-7">
							<CardTitle className="text-[1.4rem] tracking-[-0.04em]">
								Create Workspace
							</CardTitle>
							<CardDescription>
								Start fresh and create your first workspace.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-5 px-6 py-6 sm:px-7 sm:py-7">
							<p className={formHintClassName}>
								You can invite teammates later from the People tab.
							</p>
							<Button
								onClick={() => router.push("/workspace/new")}
								className={formPrimaryButtonClassName}
							>
								Create New Workspace
							</Button>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
