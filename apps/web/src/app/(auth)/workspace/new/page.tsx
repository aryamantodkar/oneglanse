"use client";

import {
	formFieldClassName,
	formHintClassName,
	formLabelClassName,
	formPrimaryButtonClassName,
	formSurfaceClassName,
} from "@/components/forms/auth-form-chrome";
import { authClient } from "@/lib/auth/auth-client";
import { api } from "@/trpc/react";
import {
	Button,
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
	Input,
	Label,
	toast,
} from "@oneglanse/ui";
import { cn } from "@oneglanse/utils";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

function toSlug(input: string): string {
	return input
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.replace(/-{2,}/g, "-");
}

function toDomainFromSlug(slug: string): string {
	return slug ? `www.${slug}.com` : "";
}

export default function NewWorkspace() {
	const [formData, setFormData] = useState({
		organizationName: "",
		workspaceName: "",
		workspaceSlug: "",
		domain: "",
	});
	const [slugTouched, setSlugTouched] = useState(false);
	const [domainTouched, setDomainTouched] = useState(false);
	const [loading, setLoading] = useState(false);
	const router = useRouter();

	const createWorkspaceMutation = api.workspace.create.useMutation({
		onError: (error) => {
			console.error("Workspace creation failed", error);
			toast.error("Workspace creation failed");
		},
	});

	const handleComplete = async () => {
		if (
			!formData.organizationName ||
			!formData.workspaceSlug ||
			!formData.workspaceName ||
			!formData.domain
		) {
			toast.error("Please fill all the mandatory fields.");
			return;
		}

		setLoading(true);
		try {
			const { data: uniqueSlug, error: slugError } =
				await authClient.organization.checkSlug({
					slug: formData.workspaceSlug,
				});

			if (slugError || !uniqueSlug) {
				toast.error("Workspace slug already exists. Please choose another.");
				return;
			}

			const response = await createWorkspaceMutation.mutateAsync({
				organizationName: formData.organizationName.trim(),
				name: formData.workspaceName.trim(),
				slug: formData.workspaceSlug.trim(),
				domain: formData.domain.trim(),
			});

			const { workspace, org, isFirstWorkspace } =
				response as typeof response & {
					isFirstWorkspace?: boolean;
				};

			try {
				await authClient.organization.setActive({
					organizationId: org.id,
					organizationSlug: org.slug ?? undefined,
				});
			} catch (err) {
				console.error("Error setting active organization", err);
				toast.error("Could not set active workspace.");
				return;
			}

			toast.success("Workspace created successfully!");
			router.refresh();
			if (isFirstWorkspace) {
				return router.replace(`/onboarding?workspace=${workspace.id}`);
			}
			return router.replace(`/dashboard?workspace=${workspace.id}`);
		} finally {
			setLoading(false);
		}
	};

	const handleWorkspaceNameChange = (workspaceName: string) => {
		const nextSlug = toSlug(workspaceName);
		const nextDomain = toDomainFromSlug(nextSlug);

		setFormData((prev) => ({
			...prev,
			workspaceName,
			workspaceSlug: slugTouched ? prev.workspaceSlug : nextSlug,
			domain: domainTouched ? prev.domain : nextDomain,
		}));
	};

	return (
		<div className="flex min-h-svh min-w-0 items-center justify-center bg-stone-50 px-4 py-6 dark:bg-neutral-950 sm:px-6 sm:py-8">
			<div className="ui-stagger w-full max-w-md space-y-6">
				<div className="space-y-3 text-center">
					<h1 className="text-[2rem] font-semibold tracking-[-0.05em] text-gray-950 dark:text-gray-50">
						Create your workspace
					</h1>
					<p className="text-sm text-gray-600 dark:text-gray-300">
						Set up your organization and brand tracking workspace in one clean
						step.
					</p>
				</div>
				<Card className={formSurfaceClassName}>
					<CardHeader className="space-y-2 px-6 pt-6 pb-0 sm:px-7 sm:pt-8">
						<CardTitle className="text-[1.55rem] tracking-[-0.04em]">
							Brand Workspace Setup
						</CardTitle>
						<CardDescription>
							Set up your organization and brand tracking workspace.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-5 px-6 py-6 sm:px-7 sm:py-7">
						<div className="space-y-2.5">
							<Label htmlFor="organization-name" className={formLabelClassName}>
								Organization Name
							</Label>
							<Input
								className={formFieldClassName}
								id="organization-name"
								placeholder="Enter your organization name"
								value={formData.organizationName}
								onChange={(e) =>
									setFormData((prev) => ({
										...prev,
										organizationName: e.target.value,
									}))
								}
							/>
						</div>

						<div className="space-y-2.5">
							<Label htmlFor="workspace-name" className={formLabelClassName}>
								Brand Name
							</Label>
							<Input
								className={formFieldClassName}
								id="workspace-name"
								placeholder="e.g. Pipedrive"
								value={formData.workspaceName}
								onChange={(e) => handleWorkspaceNameChange(e.target.value)}
							/>
							<p className={formHintClassName}>
								This is used as your tracked brand name in AI visibility
								analysis.
							</p>
						</div>

						<div className="space-y-2.5">
							<Label htmlFor="workspace-slug" className={formLabelClassName}>
								Workspace Slug
							</Label>
							<Input
								id="workspace-slug"
								placeholder="brand-workspace-slug"
								value={formData.workspaceSlug}
								className={formFieldClassName}
								onChange={(e) => {
									setSlugTouched(true);
									setFormData((prev) => ({
										...prev,
										workspaceSlug: e.target.value,
									}));
								}}
							/>
						</div>

						<div className="space-y-2.5">
							<Label htmlFor="workspace-domain" className={formLabelClassName}>
								Brand Domain
							</Label>
							<Input
								id="workspace-domain"
								placeholder="e.g. www.pipedrive.com"
								value={formData.domain}
								className={formFieldClassName}
								onChange={(e) => {
									setDomainTouched(true);
									setFormData((prev) => ({
										...prev,
										domain: e.target.value,
									}));
								}}
							/>
							<p className={formHintClassName}>
								Use your primary brand domain. We use this for source matching
								and brand tracking.
							</p>
						</div>
					</CardContent>

					<CardFooter className="px-6 pb-6 sm:px-7 sm:pb-8">
						<div className="w-full space-y-3">
							<Button
								onClick={handleComplete}
								disabled={
									loading ||
									!formData.organizationName.trim() ||
									!formData.workspaceName.trim() ||
									!formData.workspaceSlug.trim() ||
									!formData.domain.trim()
								}
								className={cn(
									formPrimaryButtonClassName,
									"flex items-center gap-2",
								)}
							>
								{loading ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									"Create Workspace"
								)}
							</Button>
							<button
								type="button"
								onClick={() => router.push("/workspace")}
								className="w-full text-sm text-gray-500 hover:text-gray-700"
							>
								Already have a code? Join an existing workspace
							</button>
						</div>
					</CardFooter>
				</Card>
			</div>
		</div>
	);
}
