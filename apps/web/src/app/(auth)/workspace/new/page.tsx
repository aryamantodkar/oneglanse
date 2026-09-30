"use client";

import {
	formFieldClassName,
	formHintClassName,
	formLabelClassName,
	formPrimaryButtonClassName,
	formSurfaceClassName,
} from "@/components/forms/auth-form-chrome";
import { env } from "@/env";
import { authClient } from "@/lib/auth/auth-client";
import { api } from "@/trpc/react";
import { resolveAppMode } from "@oneglanse/types";
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

	const createWorkspaceMutation = api.workspace.create.useMutation();

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
				setLoading(false);
				return;
			}

			toast.success("Workspace created successfully!");
			router.refresh();
			if (isFirstWorkspace) {
				const appMode = resolveAppMode(env.NEXT_PUBLIC_ONEGLANSE_APP_MODE);
				if (appMode === "local") {
					router.replace(
						`/providers?next=/onboarding?workspace=${workspace.id}`,
					);
				} else {
					router.replace(`/onboarding?workspace=${workspace.id}`);
				}
			} else {
				router.replace(`/dashboard?workspace=${workspace.id}`);
			}
			// loading stays true while navigation completes
		} catch {
			toast.error("Workspace creation failed");
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
		<div className="flex min-h-full min-w-0 w-full items-start justify-center overflow-y-auto overflow-x-hidden bg-stone-50 px-4 py-5 dark:bg-neutral-950 sm:items-center sm:px-8 sm:py-7 lg:px-10 xl:px-14 xl:py-10">
			<div className="ui-stagger min-w-0 w-full max-w-[21.25rem] self-start sm:max-w-[22.5rem] lg:max-w-[23.5rem] xl:max-w-[29rem] 2xl:max-w-[31rem] sm:self-auto">
				<Card className={formSurfaceClassName}>
					<CardHeader className="space-y-0 px-4 pt-3 pb-0 sm:px-4.5 sm:pt-3.25 lg:px-5 lg:pt-3.5 xl:px-6 xl:pt-4.5">
						<CardTitle className="text-[1rem] tracking-[-0.04em] text-gray-950 sm:text-[1.14rem] lg:text-[1.28rem] xl:text-[1.55rem] dark:text-gray-50">
							Brand Workspace Setup
						</CardTitle>
						<CardDescription className="text-[10px] leading-4 text-gray-500 dark:text-gray-400 sm:text-[11px] sm:leading-4.5 lg:text-[12px] lg:leading-5 xl:text-[13px] xl:leading-5.5">
							Set up your organization and brand tracking workspace.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-1.75 px-4 pt-2 pb-3.25 sm:space-y-2 sm:px-4.5 sm:pt-2.25 sm:pb-3.75 lg:space-y-2.25 lg:px-5 lg:pt-2.5 lg:pb-4.25 xl:space-y-2.75 xl:px-6 xl:pt-3 xl:pb-5">
						<div className="space-y-0.75 sm:space-y-1">
							<Label htmlFor="organization-name" className={formLabelClassName}>
								Organization Name
							</Label>
							<Input
								className={formFieldClassName}
								id="organization-name"
								name="organizationName"
								autoComplete="organization"
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

						<div className="space-y-0.75 sm:space-y-1">
							<Label htmlFor="workspace-name" className={formLabelClassName}>
								Brand Name
							</Label>
							<Input
								className={formFieldClassName}
								id="workspace-name"
								name="workspaceName"
								placeholder="e.g. Pipedrive"
								value={formData.workspaceName}
								onChange={(e) => handleWorkspaceNameChange(e.target.value)}
							/>
							<p className={formHintClassName}>
								This is used as your tracked brand name in AI visibility
								analysis.
							</p>
						</div>

						<div className="space-y-0.75 sm:space-y-1">
							<Label htmlFor="workspace-slug" className={formLabelClassName}>
								Workspace Slug
							</Label>
							<Input
								id="workspace-slug"
								name="workspaceSlug"
								autoComplete="off"
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

						<div className="space-y-0.75 sm:space-y-1">
							<Label htmlFor="workspace-domain" className={formLabelClassName}>
								Brand Domain
							</Label>
							<Input
								id="workspace-domain"
								name="workspaceDomain"
								autoComplete="url"
								inputMode="url"
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

					<CardFooter className="shrink-0 px-4 pb-3.5 sm:px-4.5 sm:pb-4 lg:px-5 lg:pb-4.5 xl:px-6 xl:pb-5">
						<div className="w-full space-y-1.25 sm:space-y-1.5 xl:space-y-2">
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
								className="w-full text-[10px] text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 sm:text-[11px] lg:text-[12px] xl:text-[13px]"
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
