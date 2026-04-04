"use client";

import { WorkspaceDialogShell } from "@/components/dialogs/workspace-dialog-shell";
import {
	formFieldClassName,
	formHintClassName,
	formLabelClassName,
	formPrimaryButtonClassName,
} from "@/components/forms/auth-form-chrome";
import { api } from "@/trpc/react";
import { Button, Input, Label, toast } from "@oneglanse/ui";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface CreateWorkspaceDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	tenantId: string;
}

export function CreateWorkspaceDialog({
	open,
	onOpenChange,
	tenantId,
}: CreateWorkspaceDialogProps) {
	const [formData, setFormData] = useState({
		name: "",
		slug: "",
		domain: "",
	});
	const [loading, setLoading] = useState(false);
	const router = useRouter();
	const utils = api.useUtils();

	const createInOrgMutation = api.workspace.createInOrg.useMutation();

	const resetForm = () => {
		setFormData({ name: "", slug: "", domain: "" });
	};

	const handleNameChange = (value: string) => {
		const slug = value
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "");
		setFormData({ ...formData, name: value, slug });
	};

	const handleSubmit = async () => {
		if (
			!formData.name.trim() ||
			!formData.slug.trim() ||
			!formData.domain.trim()
		) {
			toast.error("Please fill all mandatory fields.");
			return;
		}

		setLoading(true);
		try {
			const response = await createInOrgMutation.mutateAsync({
				name: formData.name.trim(),
				slug: formData.slug.trim(),
				domain: formData.domain.trim(),
				tenantId,
			});

			const { workspace, isFirstWorkspace } = response as {
				workspace: { id: string };
				isFirstWorkspace?: boolean;
			};

			await utils.workspace.listByOrg.invalidate({ tenantId });

			toast.success("Workspace created!");
			resetForm();
			onOpenChange(false);
			router.refresh();
			if (isFirstWorkspace) {
				router.push(`/onboarding?workspace=${workspace.id}`);
			} else {
				router.push(`/dashboard?workspace=${workspace.id}`);
			}
		} catch (err) {
			console.error(err);
			toast.error("Failed to create workspace.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<WorkspaceDialogShell
			open={open}
			onOpenChange={onOpenChange}
			onCloseReset={resetForm}
			title="Create Workspace"
			description="Add a new brand workspace to this organization."
			footerActions={
				<Button
					onClick={handleSubmit}
					disabled={loading}
					className={formPrimaryButtonClassName}
				>
					{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
				</Button>
			}
		>
			<div className="space-y-5">
				<div className="space-y-2.5">
					<Label htmlFor="ws-name" className={formLabelClassName}>
						Brand Name
					</Label>
					<Input
						id="ws-name"
						placeholder="e.g. Pipedrive"
						value={formData.name}
						onChange={(e) => handleNameChange(e.target.value)}
						className={formFieldClassName}
					/>
					<p className={formHintClassName}>
						Used as the tracked brand name in analysis.
					</p>
				</div>
				<div className="space-y-2.5">
					<Label htmlFor="ws-slug" className={formLabelClassName}>
						Slug
					</Label>
					<Input
						id="ws-slug"
						placeholder="my-workspace"
						value={formData.slug}
						onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
						className={formFieldClassName}
					/>
				</div>
				<div className="space-y-2.5">
					<Label htmlFor="ws-domain" className={formLabelClassName}>
						Brand Domain
					</Label>
					<Input
						id="ws-domain"
						placeholder="e.g. pipedrive.com"
						value={formData.domain}
						onChange={(e) =>
							setFormData({ ...formData, domain: e.target.value })
						}
						className={formFieldClassName}
					/>
					<p className={formHintClassName}>
						Used for source matching and brand visibility tracking.
					</p>
				</div>
			</div>
		</WorkspaceDialogShell>
	);
}
