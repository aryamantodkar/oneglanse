"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  toast,
} from "@onescope/ui";
import {
  Loader2,
  Plus,
  Trash2,
  Users,
  Building,
  Mail,
  Clock,
  X,
} from "lucide-react";
import { authClient } from "@/lib/auth/auth-client";
import { api } from "@/trpc/react";

interface OrgMember {
  id: string;
  userId: string;
  organizationId: string;
  role: string;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    image?: string;
  };
}

interface OrgInvitation {
  id: string;
  email: string;
  role: string | null;
  status: string;
  expiresAt: Date;
  organizationId: string;
  inviterId: string;
}

interface WorkspaceMember {
  memberId: string;
  userId: string;
  role: string;
  joinedAt: Date;
  userName: string;
  userEmail: string;
  userImage: string | null;
}

export default function PeoplePage() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspace") ?? "";

  // Org members state
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  const [orgInvitations, setOrgInvitations] = useState<OrgInvitation[]>([]);
  const [orgLoading, setOrgLoading] = useState(true);
  const [orgInviteEmail, setOrgInviteEmail] = useState("");
  const [orgInviteRole, setOrgInviteRole] = useState("member");
  const [orgInviting, setOrgInviting] = useState(false);

  // Workspace members state
  const [wsInviteEmail, setWsInviteEmail] = useState("");
  const [wsInviteRole, setWsInviteRole] = useState("member");
  const [wsAdding, setWsAdding] = useState(false);

  // Workspace members via tRPC
  const wsMembersQuery = api.workspace.listMembers.useQuery(
    { workspaceId },
    { enabled: !!workspaceId }
  );
  const wsMembers = (wsMembersQuery.data?.data ?? []) as WorkspaceMember[];

  const addWsMemberMutation = api.workspace.addMember.useMutation();
  const removeWsMemberMutation = api.workspace.removeMember.useMutation();

  // Fetch org data
  const fetchOrgData = async () => {
    setOrgLoading(true);
    try {
      const { data, error } = await authClient.organization.getFullOrganization();
      if (error) {
        console.error("Failed to fetch organization:", error);
        return;
      }
      if (data) {
        setOrgMembers((data.members ?? []) as OrgMember[]);
        setOrgInvitations(
          ((data.invitations ?? []) as OrgInvitation[]).filter(
            (inv) => inv.status === "pending"
          )
        );
      }
    } catch (err) {
      console.error("Error fetching organization data:", err);
    } finally {
      setOrgLoading(false);
    }
  };

  useEffect(() => {
    fetchOrgData();
  }, []);

  // Org invite handler
  const handleOrgInvite = async () => {
    if (!orgInviteEmail.trim()) {
      toast.error("Please enter an email address.");
      return;
    }

    setOrgInviting(true);
    try {
      const { error } = await authClient.organization.inviteMember({
        email: orgInviteEmail.trim(),
        role: orgInviteRole as "member" | "admin" | "owner",
      });

      if (error) {
        toast.error((error as any)?.message ?? "Failed to send invitation.");
        return;
      }

      toast.success("Invitation sent!");
      setOrgInviteEmail("");
      await fetchOrgData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to send invitation.");
    } finally {
      setOrgInviting(false);
    }
  };

  // Org remove handler
  const handleOrgRemove = async (memberIdOrEmail: string) => {
    try {
      const { error } = await authClient.organization.removeMember({
        memberIdOrEmail,
      });

      if (error) {
        toast.error((error as any)?.message ?? "Failed to remove member.");
        return;
      }

      toast.success("Member removed from organization.");
      await fetchOrgData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to remove member.");
    }
  };

  // Cancel invitation handler
  const handleCancelInvitation = async (invitationId: string) => {
    try {
      const { error } = await authClient.organization.cancelInvitation({
        invitationId,
      });

      if (error) {
        toast.error((error as any)?.message ?? "Failed to cancel invitation.");
        return;
      }

      toast.success("Invitation cancelled.");
      await fetchOrgData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to cancel invitation.");
    }
  };

  // Workspace add member handler
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

      if (!result?.success) {
        toast.error(result?.message ?? "Failed to add member.");
        return;
      }

      toast.success("Member added to workspace!");
      setWsInviteEmail("");
      await wsMembersQuery.refetch();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message ?? "Failed to add member to workspace.");
    } finally {
      setWsAdding(false);
    }
  };

  // Workspace remove member handler
  const handleWsRemoveMember = async (userId: string) => {
    try {
      const result = await removeWsMemberMutation.mutateAsync({
        workspaceId,
        userId,
      });

      if (!result?.success) {
        toast.error(result?.message ?? "Failed to remove member.");
        return;
      }

      toast.success("Member removed from workspace.");
      await wsMembersQuery.refetch();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message ?? "Failed to remove member.");
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
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-sm text-gray-500">No workspace selected.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 py-6">
      {/* Organization Members Section */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Building className="h-5 w-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Organization Members
          </h2>
        </div>

        {/* Invite form */}
        <div className="mb-4 flex items-center gap-2">
          <Input
            placeholder="Email address"
            value={orgInviteEmail}
            onChange={(e) => setOrgInviteEmail(e.target.value)}
            className="max-w-xs"
            onKeyDown={(e) => e.key === "Enter" && handleOrgInvite()}
          />
          <Select value={orgInviteRole} onValueChange={setOrgInviteRole}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">Member</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="owner">Owner</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={handleOrgInvite}
            disabled={orgInviting || !orgInviteEmail.trim()}
            size="sm"
            className="gap-2"
          >
            {orgInviting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Mail className="h-4 w-4" />
                Invite
              </>
            )}
          </Button>
        </div>

        {/* Members table */}
        {orgLoading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading members...
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/70 dark:bg-gray-900/40">
                  <TableHead className="px-4 py-3">Name</TableHead>
                  <TableHead className="px-4 py-3">Email</TableHead>
                  <TableHead className="px-4 py-3">Role</TableHead>
                  <TableHead className="px-4 py-3 w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {orgMembers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-sm text-gray-500">
                      No members yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  orgMembers.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                        {member.user.name}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {member.user.email}
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
                            onClick={() => handleOrgRemove(member.id)}
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

        {/* Pending Invitations */}
        {orgInvitations.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Pending Invitations
              </h3>
            </div>
            <div className="space-y-2">
              {orgInvitations.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between rounded-lg border border-dashed border-gray-200 px-4 py-2 dark:border-gray-800"
                >
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {inv.email}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getRoleBadgeClass(inv.role ?? "member")}`}
                    >
                      {inv.role ?? "member"}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCancelInvitation(inv.id)}
                    className="h-8 w-8 p-0 text-gray-400 hover:text-red-600"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <Separator />

      {/* Workspace Members Section */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Workspace Members
          </h2>
        </div>

        {/* Add member form */}
        <div className="mb-4 flex items-center gap-2">
          <Input
            placeholder="Email address (must be an org member)"
            value={wsInviteEmail}
            onChange={(e) => setWsInviteEmail(e.target.value)}
            className="max-w-xs"
            onKeyDown={(e) => e.key === "Enter" && handleWsAddMember()}
          />
          <Select value={wsInviteRole} onValueChange={setWsInviteRole}>
            <SelectTrigger className="w-32">
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
            size="sm"
            className="gap-2"
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

        {/* Workspace members table */}
        {wsMembersQuery.isLoading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading workspace members...
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
            <Table>
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
                    <TableCell colSpan={4} className="py-8 text-center text-sm text-gray-500">
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
                            onClick={() => handleWsRemoveMember(member.userId)}
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
