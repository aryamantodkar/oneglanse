"use client";

import {
	formFieldClassName,
	formHintClassName,
	formLabelClassName,
	formPanelClassName,
	formPrimaryButtonClassName,
	formSecondaryButtonClassName,
} from "@/components/forms/auth-form-chrome";
import { useSafeSearchParams } from "@/lib/navigation/use-safe-search-params";
import { api } from "@/trpc/react";
import {
	Button,
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Skeleton,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	toast,
} from "@oneglanse/ui";
import { cn } from "@oneglanse/utils";
import {
	Building2,
	Loader2,
	Pencil,
	Plus,
	Trash2,
	Users,
	X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLayoutWorkspace } from "../workspace-context";

interface WorkspaceMember {
	memberId: string;
	userId: string;
	role: string;
	joinedAt: Date;
	userName: string;
	userEmail: string;
	userImage: string | null;
}

const WORKSPACE_MEMBER_SKELETON_KEYS = [
	"workspace-member-a",
	"workspace-member-b",
	"workspace-member-c",
	"workspace-member-d",
] as const;

export default function PeoplePage() {
	const searchParams = useSafeSearchParams();
	const workspaceId = searchParams.get("workspace") ?? "";
	const utils = api.useUtils();
	const layoutWorkspace = useLayoutWorkspace();

	// Invite state
	const [wsInviteEmail, setWsInviteEmail] = useState("");
	const [wsInviteRole, setWsInviteRole] = useState("member");
	const [wsAdding, setWsAdding] = useState(false);

	// Edit state
	const [workspaceName, setWorkspaceName] = useState("");
	const [workspaceDomain, setWorkspaceDomain] = useState("");
	const [organizationName, setOrganizationName] = useState("");
	const [savingWorkspace, setSavingWorkspace] = useState(false);
	const [savingOrg, setSavingOrg] = useState(false);
	const [isEditingWorkspace, setIsEditingWorkspace] = useState(false);
	const [isEditingOrg, setIsEditingOrg] = useState(false);

	// Queries
	const wsMembersQuery = api.workspace.listMembers.useQuery(
		{ workspaceId },
		{ enabled: !!workspaceId },
	);
	const workspaceQuery = api.workspace.getById.useQuery(
		{ workspaceId },
		{
			enabled: !!workspaceId,
			initialData:
				layoutWorkspace?.id === workspaceId ? layoutWorkspace : undefined,
		},
	);
	const joinInfoQuery = api.workspace.getJoinInfo.useQuery(
		{ workspaceId },
		{ enabled: !!workspaceId },
	);

	const wsMembers = (wsMembersQuery.data ?? []) as WorkspaceMember[];
	const joinInfo = joinInfoQuery.data;
	const joinInfoLoading = joinInfoQuery.isLoading;
	const workspace = workspaceQuery.data;
	const organization = joinInfo?.organization;

	// Mutations
	const addWsMemberMutation = api.workspace.addMember.useMutation();
	const removeWsMemberMutation = api.workspace.removeMember.useMutation();
	const updateWorkspaceMutation = api.workspace.updateDetails.useMutation();
	const updateOrgMutation = api.workspace.updateOrganizationName.useMutation();

	useEffect(() => {
		setWorkspaceName(workspace?.name ?? "");
		setWorkspaceDomain(workspace?.domain ?? "");
	}, [workspace?.name, workspace?.domain]);

	useEffect(() => {
		setOrganizationName(organization?.name ?? "");
	}, [organization?.name]);

	const normalizedWorkspaceName = workspaceName.trim();
	const normalizedWorkspaceDomain = workspaceDomain.trim();
	const normalizedOrganizationName = organizationName.trim();
	const workspaceDetailsChanged =
		normalizedWorkspaceName !== (workspace?.name ?? "").trim() ||
		normalizedWorkspaceDomain !== (workspace?.domain ?? "").trim();
	const organizationNameChanged =
		normalizedOrganizationName !== (organization?.name ?? "").trim();

	const handleCopy = async (value: string, label: string) => {
		if (!value) return;
		try {
			await navigator.clipboard.writeText(value);
			toast.success(`${label} copied to clipboard.`);
		} catch {
			toast.error("Failed to copy to clipboard.");
		}
	};

	const handleWsAddMember = async () => {
		if (!wsInviteEmail.trim()) {
			toast.error("Please enter an email address.");
			return;
		}
		setWsAdding(true);
		try {
			const result = await addWsMemberMutation.mutateAsync({
				workspaceId,
				email: wsInviteEmail.trim(),
				role: wsInviteRole as "owner" | "member",
			});
			if (result?.status === "not-found") {
				toast.error(
					"User not found. Share your workspace code so they can join after signing up.",
				);
				setWsInviteEmail("");
				return;
			}
			if (result?.status === "already-member") {
				toast.success("This user is already a workspace member.");
				setWsInviteEmail("");
				return;
			}
			toast.success("Member added to workspace!");
			setWsInviteEmail("");
			await wsMembersQuery.refetch();
		} catch (err) {
			console.error(err);
			toast.error("Failed to add member to workspace.");
		} finally {
			setWsAdding(false);
		}
	};

	const handleWsRemoveMember = async (userId: string, role: string) => {
		try {
			await removeWsMemberMutation.mutateAsync({ workspaceId, userId, role });
			toast.success("Member removed from workspace.");
			await wsMembersQuery.refetch();
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to remove member.",
			);
		}
	};

	const handleSaveWorkspaceDetails = async () => {
		if (!workspaceName.trim() || !workspaceDomain.trim()) {
			toast.error("Please enter both brand name and brand domain.");
			return;
		}
		if (!workspaceDetailsChanged) return;

		const nextName = workspaceName.trim();
		const nextDomain = workspaceDomain.trim();
		const brandChanged =
			(workspace?.name ?? "").trim() !== nextName ||
			(workspace?.domain ?? "").trim() !== nextDomain;

		if (brandChanged) {
			const confirmed = window.confirm(
				"Changing brand details will erase all analyzed data for this workspace and require re-analysis. Prompt responses will remain intact. Continue?",
			);
			if (!confirmed) return;
		}

		setSavingWorkspace(true);
		try {
			const result = await updateWorkspaceMutation.mutateAsync({
				workspaceId,
				name: nextName,
				domain: nextDomain,
			});
			if (result?.analysisReset) {
				toast.success(
					"Brand details updated. Previous analysis was cleared and will be regenerated on next analysis run.",
				);
			} else {
				toast.success("Workspace details updated.");
			}
			await workspaceQuery.refetch();
			await joinInfoQuery.refetch();
			await utils.workspace.listAllForUser.invalidate();
			await utils.workspace.getById.invalidate({ workspaceId });
			await utils.workspace.getJoinInfo.invalidate({ workspaceId });
			setIsEditingWorkspace(false);
		} catch (err) {
			toast.error(
				err instanceof Error
					? err.message
					: "Failed to update workspace details.",
			);
		} finally {
			setSavingWorkspace(false);
		}
	};

	const handleSaveOrganizationName = async () => {
		if (!organizationName.trim()) {
			toast.error("Please enter an organization name.");
			return;
		}
		if (!organizationNameChanged) return;
		setSavingOrg(true);
		try {
			await updateOrgMutation.mutateAsync({
				workspaceId,
				organizationName: organizationName.trim(),
			});
			toast.success("Organization name updated.");
			await joinInfoQuery.refetch();
			await utils.workspace.listAllForUser.invalidate();
			await utils.workspace.getJoinInfo.invalidate({ workspaceId });
			setIsEditingOrg(false);
		} catch (err) {
			toast.error(
				err instanceof Error
					? err.message
					: "Only workspace owners can update organization name.",
			);
		} finally {
			setSavingOrg(false);
		}
	};

	const getRoleBadgeClass = (role: string) => {
		switch (role) {
			case "owner":
				return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
			case "admin":
				return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
			default:
				return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
		}
	};

	if (!workspaceId) {
		return (
			<div className="web-centered-state">
				<div className="web-empty-state">
					<p className="text-sm text-gray-500 dark:text-gray-400">
						No workspace selected.
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="web-page-panel max-w-4xl">
			{/* Page Header */}
			<div className="mb-6 flex items-center gap-2">
				<Users className="h-6 w-6 shrink-0 text-gray-500" />
				<h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
					People
				</h1>
			</div>

			{/* Workspace & Organization */}
			<section>
				<div className="mb-4 flex items-center gap-2">
					<h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
						Workspace & Organization
					</h2>
				</div>
				<div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2">
					{/* Brand Workspace */}
					<div className={cn(formPanelClassName, "flex h-full flex-col p-5")}>
						<div className="mb-3 flex items-center justify-between gap-2">
							<div className="flex items-center gap-2">
								<Users className="h-4 w-4 text-gray-500" />
								<p className="text-sm font-medium text-gray-900 dark:text-gray-100">
									Brand Workspace
								</p>
							</div>
							<Button
								variant="ghost"
								size="sm"
								className="h-8 w-8 p-0"
								onClick={() => {
									if (isEditingWorkspace) {
										setWorkspaceName(workspace?.name ?? "");
										setWorkspaceDomain(workspace?.domain ?? "");
										setIsEditingWorkspace(false);
										return;
									}
									setIsEditingWorkspace(true);
								}}
								aria-label={
									isEditingWorkspace
										? "Cancel editing workspace"
										: "Edit workspace"
								}
							>
								{isEditingWorkspace ? (
									<X className="h-4 w-4" />
								) : (
									<Pencil className="h-4 w-4" />
								)}
							</Button>
						</div>
						<div className="space-y-2">
							<Label
								htmlFor="people-workspace-name"
								className={formLabelClassName}
							>
								Brand Name
							</Label>
							<Input
								id="people-workspace-name"
								value={workspaceName}
								onChange={(e) => setWorkspaceName(e.target.value)}
								placeholder="e.g. Pipedrive"
								disabled={!isEditingWorkspace}
								className={formFieldClassName}
							/>
						</div>
						<div className="mt-3 space-y-2">
							<Label
								htmlFor="people-workspace-domain"
								className={formLabelClassName}
							>
								Brand Domain
							</Label>
							<Input
								id="people-workspace-domain"
								value={workspaceDomain}
								onChange={(e) => setWorkspaceDomain(e.target.value)}
								placeholder="e.g. pipedrive.com"
								disabled={!isEditingWorkspace}
								className={formFieldClassName}
							/>
							<p className={formHintClassName}>
								Used to track your brand visibility and citations in AI
								responses.
							</p>
							{isEditingWorkspace && (
								<div className="rounded-[20px] border border-amber-200 bg-amber-50 px-3 py-3 dark:border-amber-900/60 dark:bg-amber-950/20">
									<p className="text-xs text-amber-800 dark:text-amber-300">
										Warning: Changing brand details clears all analyzed data in
										this workspace. Raw prompt responses are not deleted.
									</p>
								</div>
							)}
						</div>
						<div className="mt-auto flex flex-col gap-2 pt-3 sm:flex-row sm:items-center sm:justify-end">
							{isEditingWorkspace && (
								<>
									<Button
										variant="outline"
										className={cn(
											formSecondaryButtonClassName,
											"w-full sm:w-auto",
										)}
										onClick={() => {
											setWorkspaceName(workspace?.name ?? "");
											setWorkspaceDomain(workspace?.domain ?? "");
											setIsEditingWorkspace(false);
										}}
										disabled={savingWorkspace}
									>
										Cancel
									</Button>
									<Button
										onClick={handleSaveWorkspaceDetails}
										disabled={
											savingWorkspace ||
											!workspaceName.trim() ||
											!workspaceDomain.trim() ||
											!workspaceDetailsChanged
										}
										className={cn(
											formPrimaryButtonClassName,
											"w-full sm:w-auto",
										)}
									>
										{savingWorkspace ? (
											<Loader2 className="h-4 w-4 animate-spin" />
										) : (
											"Save"
										)}
									</Button>
								</>
							)}
						</div>
					</div>

					{/* Organization */}
					<div className={cn(formPanelClassName, "flex h-full flex-col p-5")}>
						<div className="mb-3 flex items-center justify-between gap-2">
							<div className="flex items-center gap-2">
								<Building2 className="h-4 w-4 text-gray-500" />
								<p className="text-sm font-medium text-gray-900 dark:text-gray-100">
									Organization
								</p>
							</div>
							<Button
								variant="ghost"
								size="sm"
								className="h-8 w-8 p-0"
								onClick={() => {
									if (isEditingOrg) {
										setOrganizationName(organization?.name ?? "");
										setIsEditingOrg(false);
										return;
									}
									setIsEditingOrg(true);
								}}
								aria-label={
									isEditingOrg
										? "Cancel editing organization"
										: "Edit organization"
								}
							>
								{isEditingOrg ? (
									<X className="h-4 w-4" />
								) : (
									<Pencil className="h-4 w-4" />
								)}
							</Button>
						</div>
						<div className="space-y-2">
							<Label htmlFor="people-org-name" className={formLabelClassName}>
								Organization Name
							</Label>
							<Input
								id="people-org-name"
								value={organizationName}
								onChange={(e) => setOrganizationName(e.target.value)}
								placeholder="Enter organization name"
								disabled={!isEditingOrg}
								className={formFieldClassName}
							/>
							<p className={formHintClassName}>
								Only workspace owners can rename the organization.
							</p>
						</div>
						<div className="mt-auto flex flex-col gap-2 pt-3 sm:flex-row sm:items-center sm:justify-end">
							{isEditingOrg && (
								<>
									<Button
										variant="outline"
										className={cn(
											formSecondaryButtonClassName,
											"w-full sm:w-auto",
										)}
										onClick={() => {
											setOrganizationName(organization?.name ?? "");
											setIsEditingOrg(false);
										}}
										disabled={savingOrg}
									>
										Cancel
									</Button>
									<Button
										onClick={handleSaveOrganizationName}
										disabled={
											savingOrg ||
											!organizationName.trim() ||
											!organizationNameChanged
										}
										className={cn(
											formPrimaryButtonClassName,
											"w-full sm:w-auto",
										)}
									>
										{savingOrg ? (
											<Loader2 className="h-4 w-4 animate-spin" />
										) : (
											"Save"
										)}
									</Button>
								</>
							)}
						</div>
					</div>
				</div>
			</section>

			{/* Join Code */}
			<section>
				<div className="mb-4 flex items-center gap-2">
					<h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
						Invite with a Code
					</h2>
				</div>
				<div className={cn(formPanelClassName, "space-y-3 p-5")}>
					<div>
						<p className="text-sm font-medium text-gray-900 dark:text-gray-100">
							Workspace Join Code
						</p>
						<p className={cn(formHintClassName, "mt-1")}>
							Share this code with teammates to let them join instantly. Each
							workspace has a globally unique code.
						</p>
						{joinInfo?.organization?.name && (
							<div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-500">
								<span>
									Organization:{" "}
									<span className="font-medium text-gray-700 dark:text-gray-300">
										{joinInfo.organization.name}
									</span>
								</span>
								{joinInfo?.workspace?.name && (
									<span>
										Workspace:{" "}
										<span className="font-medium text-gray-700 dark:text-gray-300">
											{joinInfo.workspace.name}
										</span>
									</span>
								)}
							</div>
						)}
					</div>
					<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
						{joinInfoLoading ? (
							<>
								<Skeleton className="h-9 w-full sm:w-[300px]" />
								<Skeleton className="h-9 w-full sm:w-16" />
							</>
						) : (
							<>
								<Input
									readOnly
									value={joinInfo?.workspaceCode ?? ""}
									placeholder="Workspace code"
									className={cn(
										formFieldClassName,
										"w-full max-w-md font-mono text-xs",
									)}
								/>
								<Button
									variant="outline"
									size="sm"
									onClick={() =>
										handleCopy(joinInfo?.workspaceCode ?? "", "Workspace code")
									}
									disabled={!joinInfo?.workspaceCode}
									className={cn(
										formSecondaryButtonClassName,
										"w-full sm:w-auto",
									)}
								>
									Copy
								</Button>
							</>
						)}
					</div>
				</div>
			</section>

			{/* Members */}
			<section>
				<div className="mb-4 flex items-center gap-2">
					<h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
						Members
					</h2>
				</div>

				{/* Add member form */}
				<div
					className={cn(
						formPanelClassName,
						"mb-4 grid gap-3 p-5 md:grid-cols-[minmax(0,1fr)_10rem_10rem] md:items-end sm:p-6",
					)}
				>
					<Input
						placeholder="Email address (we'll invite if needed)"
						value={wsInviteEmail}
						onChange={(e) => setWsInviteEmail(e.target.value)}
						className={cn(formFieldClassName, "w-full")}
						onKeyDown={(e) => e.key === "Enter" && handleWsAddMember()}
					/>
					<Select value={wsInviteRole} onValueChange={setWsInviteRole}>
						<SelectTrigger className={cn(formFieldClassName, "w-full")}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="member">Member</SelectItem>
							<SelectItem value="owner">Owner</SelectItem>
						</SelectContent>
					</Select>
					<Button
						onClick={handleWsAddMember}
						disabled={wsAdding || !wsInviteEmail.trim()}
						className={cn(formPrimaryButtonClassName, "w-full gap-2")}
					>
						{wsAdding ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<>
								<Plus className="h-4 w-4" />
								Add
							</>
						)}
					</Button>
				</div>

				{/* Members table */}
				{wsMembersQuery.isLoading ? (
					<div className="space-y-3 py-6">
						{WORKSPACE_MEMBER_SKELETON_KEYS.map((key) => (
							<div
								key={key}
								className={cn(
									formPanelClassName,
									"flex items-center justify-between px-4 py-3",
								)}
							>
								<div className="space-y-2">
									<Skeleton className="h-4 w-32" />
									<Skeleton className="h-3 w-40" />
								</div>
								<Skeleton className="h-6 w-16 rounded-full" />
							</div>
						))}
					</div>
				) : (
					<div className="overflow-x-auto">
						<Table className="min-w-[620px] lg:min-w-[680px]">
							<TableHeader>
								<TableRow className="bg-gray-50/70 dark:bg-gray-900/40">
									<TableHead className="px-4 py-3">Name</TableHead>
									<TableHead className="px-4 py-3">Email</TableHead>
									<TableHead className="px-4 py-3">Role</TableHead>
									<TableHead className="px-4 py-3 w-20" />
								</TableRow>
							</TableHeader>
							<TableBody>
								{wsMembers.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={4}
											className="py-8 text-center text-sm text-gray-500"
										>
											No workspace members yet.
										</TableCell>
									</TableRow>
								) : (
									wsMembers.map((member) => (
										<TableRow key={member.memberId}>
											<TableCell className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
												{member.userName}
											</TableCell>
											<TableCell className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
												{member.userEmail}
											</TableCell>
											<TableCell className="px-4 py-3">
												<span
													className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getRoleBadgeClass(member.role)}`}
												>
													{member.role}
												</span>
											</TableCell>
											<TableCell className="px-4 py-3">
												{member.role !== "owner" && (
													<Button
														variant="ghost"
														size="sm"
														onClick={() =>
															handleWsRemoveMember(member.userId, member.role)
														}
														className="h-8 w-8 p-0 text-gray-400 hover:text-red-600"
													>
														<Trash2 className="h-4 w-4" />
													</Button>
												)}
											</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</div>
				)}
			</section>
		</div>
	);
}
