"use client";

import { LocationSelector } from "@/components/location/locationSelector";
import { authClient } from "@/lib/auth/auth-client";
import { api } from "@/trpc/react";
import type { WorkspaceLocation } from "@oneglanse/types";
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
	Skeleton,
	toast,
} from "@oneglanse/ui";
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

export default function NewWorkspace(){
	const [formData, setFormData] = useState({
		organizationName: "",
		workspaceName: "",
		workspaceSlug: "",
		domain: "",
	});
	const [slugTouched, setSlugTouched] = useState(false);
	const [domainTouched, setDomainTouched] = useState(false);

	const [selectedLocation, setSelectedLocation] = useState<WorkspaceLocation>({ country: "", countryName: "" });

	const [loading, setLoading] = useState(false);
	const router = useRouter();

	const countriesQuery = api.location.fetchCountries.useQuery();

	const formReady = !!countriesQuery.data;

	const createWorkspaceMutation = api.workspace.create.useMutation({
		onSuccess: async (response) => {
			try {
				const { workspace, org } = response;

				await authClient.organization.setActive({
					organizationId: org.id,
					organizationSlug: workspace.slug,
				});
			} catch (err) {
				console.error("Error setting active organization", err);
				toast.error("Could not set active workspace.");
			}
			toast.success("Workspace created successfully!");
		},
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
				country: selectedLocation.country,
				region: selectedLocation.region || null,
			});

			const { workspace, org, isFirstWorkspace } =
				response as typeof response & {
					isFirstWorkspace?: boolean;
				};

			try {
				await authClient.organization.setActive({
					organizationId: org.id,
					organizationSlug: workspace.slug,
				});
			} catch (err) {
				console.error("Error setting active organization", err);
				toast.error("Could not set active workspace.");
			}

			router.refresh();
			if (isFirstWorkspace) {
				return router.push(`/onboarding?workspace=${workspace.id}`);
			}
			return router.push(`/dashboard?workspace=${workspace.id}`);
		} finally {
			setLoading(false);
		}
	};

	const handleLocationSelect = (loc: WorkspaceLocation) => {
		setSelectedLocation(loc);
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
		<div className="web-centered-page">
			{formReady ? (
				<div className="ui-stagger w-full max-w-md">
					<Card>
						<CardHeader>
							<CardTitle>Brand Workspace Setup</CardTitle>
							<CardDescription>
								Set up your organization and brand tracking workspace.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="organization-name">Organization Name</Label>
								<Input
									className="outline-none"
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

							<div className="space-y-2">
								<Label htmlFor="workspace-name">Brand Name</Label>
								<Input
									className="outline-none"
									id="workspace-name"
									placeholder="e.g. Pipedrive"
									value={formData.workspaceName}
									onChange={(e) => handleWorkspaceNameChange(e.target.value)}
								/>
								<p className="text-xs text-gray-500">
									This is used as your tracked brand name in AI visibility
									analysis.
								</p>
							</div>

							<div className="space-y-2">
								<Label htmlFor="workspace-slug">Workspace Slug</Label>
								<Input
									id="workspace-slug"
									placeholder="brand-workspace-slug"
									value={formData.workspaceSlug}
									onChange={(e) => {
										setSlugTouched(true);
										setFormData((prev) => ({
											...prev,
											workspaceSlug: e.target.value,
										}));
									}}
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="workspace-domain">Brand Domain</Label>
								<Input
									id="workspace-domain"
									placeholder="e.g. www.pipedrive.com"
									value={formData.domain}
									onChange={(e) => {
										setDomainTouched(true);
										setFormData((prev) => ({
											...prev,
											domain: e.target.value,
										}));
									}}
								/>
								<p className="text-xs text-gray-500">
									Use your primary brand domain. We use this for source matching
									and brand tracking.
								</p>
							</div>

							<div className="space-y-2">
								<Label htmlFor="workspace-location">Workspace Location</Label>
								<LocationSelector onSelect={handleLocationSelect} />
								<p className="text-sm text-gray-500 mt-1">
									{selectedLocation?.region
										? `Prompts in this workspace will run inside ${selectedLocation.regionName}, ${selectedLocation.countryName}.`
										: `Prompts in this workspace will run inside ${selectedLocation.countryName}.`}
								</p>
							</div>
						</CardContent>

						<CardFooter>
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
									className="w-full flex items-center gap-2 cursor-pointer"
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
			) : (
				<div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
					<Skeleton className="h-8 w-48" />
					<Skeleton className="h-4 w-64" />
					<div className="w-full max-w-md space-y-3">
						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-10 w-full" />
					</div>
				</div>
			)}
		</div>
	);
}
