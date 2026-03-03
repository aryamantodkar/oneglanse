"use client";

import { WorkspaceDialogShell } from "@/components/dialogs/workspace-dialog-shell";
import { authClient } from "@/lib/auth/auth-client";
import { api } from "@/trpc/react";
import { Button, Input, Label, toast } from "@oneglanse/ui";
import { ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface JoinWorkspaceDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

type WorkspaceSelection = {
	organization: { id: string; name: string; slug: string | null };
	workspaces: { id: string; name: string; slug: string }[];
};

export function JoinWorkspaceDialog({
	open,
	onOpenChange,
}: JoinWorkspaceDialogProps) {
	const [code, setCode] = useState("");
	const [selection, setSelection] = useState<WorkspaceSelection | null>(null);
	const router = useRouter();
	const utils = api.useUtils();

	const joinMutation = api.workspace.joinByCode.useMutation();

	const resetForm = () => {
		setCode("");
		setSelection(null);
	};

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

			await utils.workspace.listAllForUser.invalidate();

			toast.success(`Joined ${workspace.name}!`);
			resetForm();
			onOpenChange(false);
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
		<WorkspaceDialogShell
			open={open}
			onOpenChange={onOpenChange}
			onCloseReset={resetForm}
			title="Join Workspace"
			description="Enter a workspace code shared by your team."
			footerActions={
				<Button
					onClick={() => handleJoin(code)}
					disabled={joinMutation.isPending || !code.trim()}
					className="gap-2"
				>
					{joinMutation.isPending ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : (
						<>
							Join
							<ArrowRight className="h-4 w-4" />
						</>
					)}
				</Button>
			}
		>
			<div className="space-y-4 py-2">
				<div className="space-y-2">
					<Label htmlFor="join-code">Workspace Code</Label>
					<Input
						id="join-code"
						placeholder="acme/marketing"
						value={code}
						onChange={(e) => setCode(e.target.value)}
						onKeyDown={(e) => e.key === "Enter" && handleJoin(code)}
					/>
				</div>

				{selection && (
					<div className="space-y-2 rounded-md border border-gray-200 border-dashed p-3">
						<p className="text-gray-600 text-sm">
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
								>
									{ws.name}
								</Button>
							))}
						</div>
					</div>
				)}
			</div>
		</WorkspaceDialogShell>
	);
}
