"use client";

import { LocationSelector } from "@/components/location/locationSelector";
import { api } from "@/trpc/react";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Input,
	Label,
	toast,
} from "@onescope/ui";
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
	const [selectedLocation, setSelectedLocation] = useState<{
		country: string;
		countryName: string;
		region?: string;
		regionName?: string;
	}>({ country: "", countryName: "" });
	const [loading, setLoading] = useState(false);
	const router = useRouter();
	const utils = api.useUtils();

	const createInOrgMutation = api.workspace.createInOrg.useMutation();

	const resetForm = () => {
		setFormData({ name: "", slug: "", domain: "" });
		setSelectedLocation({ country: "", countryName: "" });
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

		if (!selectedLocation.country) {
			toast.error("Please select a location.");
			return;
		}

		setLoading(true);
		try {
			const response = await createInOrgMutation.mutateAsync({
				name: formData.name.trim(),
				slug: formData.slug.trim(),
				domain: formData.domain.trim(),
				country: selectedLocation.country,
				region: selectedLocation.regionName || null,
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
		<Dialog
			open={open}
			onOpenChange={(isOpen) => {
				if (!isOpen) resetForm();
				onOpenChange(isOpen);
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Create Workspace</DialogTitle>
					<DialogDescription>
						Add a new brand workspace to this organization.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4 py-2">
					<div className="space-y-2">
						<Label htmlFor="ws-name">Brand Name</Label>
						<Input
							id="ws-name"
							placeholder="e.g. Pipedrive"
							value={formData.name}
							onChange={(e) => handleNameChange(e.target.value)}
						/>
						<p className="text-xs text-gray-500">
							Used as the tracked brand name in analysis.
						</p>
					</div>
					<div className="space-y-2">
						<Label htmlFor="ws-slug">Slug</Label>
						<Input
							id="ws-slug"
							placeholder="my-workspace"
							value={formData.slug}
							onChange={(e) =>
								setFormData({ ...formData, slug: e.target.value })
							}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="ws-domain">Brand Domain</Label>
						<Input
							id="ws-domain"
							placeholder="e.g. pipedrive.com"
							value={formData.domain}
							onChange={(e) =>
								setFormData({ ...formData, domain: e.target.value })
							}
						/>
						<p className="text-xs text-gray-500">
							Used for source matching and brand visibility tracking.
						</p>
					</div>
					<div className="space-y-2">
						<Label>Location</Label>
						<LocationSelector onSelect={setSelectedLocation} />
					</div>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={handleSubmit} disabled={loading}>
						{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
