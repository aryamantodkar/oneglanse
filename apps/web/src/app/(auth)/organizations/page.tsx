"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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
  Building,
  Mail,
  Clock,
  X,
  ArrowRightLeft,
  Check,
} from "lucide-react";
import { authClient } from "@/lib/auth/auth-client";
import { api } from "@/trpc/react";
import { CreateOrganizationDialog } from "@/components/dialogs/create-organization-dialog";
import type { Organization } from "@onescope/db";

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

export default function OrganizationsPage() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspace") ?? "";
  const router = useRouter();
  const utils = api.useUtils();

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitching, setIsSwitching] = useState<string | null>(null);
  const [showCreateOrgDialog, setShowCreateOrgDialog] = useState(false);

  // Active org details
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  const [orgInvitations, setOrgInvitations] = useState<OrgInvitation[]>([]);
  const [orgDetailsLoading, setOrgDetailsLoading] = useState(false);
  const [orgInviteEmail, setOrgInviteEmail] = useState("");
  const [orgInviteRole, setOrgInviteRole] = useState("member");
  const [orgInviting, setOrgInviting] = useState(false);

  // Fetch all organizations
  const fetchOrganizations = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await authClient.organization.list();
      if (error) {
        console.error("Failed to fetch organizations:", error);
        return;
      }
      const orgs = (data ?? []) as Organization[];
      setOrganizations(orgs);
    } catch (err) {
      console.error("Error fetching organizations:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch active org details (members + invitations)
  const fetchActiveOrgDetails = async () => {
    setOrgDetailsLoading(true);
    try {
      const { data, error } = await authClient.organization.getFullOrganization();
      if (error) {
        console.error("Failed to fetch organization details:", error);
        return;
      }
      if (data) {
        setActiveOrgId(data.id);
        setOrgMembers((data.members ?? []) as OrgMember[]);
        setOrgInvitations(
          ((data.invitations ?? []) as OrgInvitation[]).filter(
            (inv) => inv.status === "pending"
          )
        );
      }
    } catch (err) {
      console.error("Error fetching organization details:", err);
    } finally {
      setOrgDetailsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizations();
    fetchActiveOrgDetails();
  }, []);

  // Switch organization
  const handleSwitchOrg = async (orgId: string) => {
    if (orgId === activeOrgId) return;

    setIsSwitching(orgId);
    try {
      await authClient.organization.setActive({ organizationId: orgId });

      const result = await utils.workspace.listByOrg.fetch({ tenantId: orgId });

      if (result?.success && result.data && result.data.length > 0) {
        const firstWorkspace = result.data[0]!;
        router.refresh();
        router.push(`/dashboard?workspace=${firstWorkspace.id}`);
      } else {
        router.refresh();
        router.push("/workspace");
      }
    } catch (err) {
      console.error("Failed to switch organization:", err);
      toast.error("Failed to switch organization.");
    } finally {
      setIsSwitching(null);
    }
  };

  // Invite member to org
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
      await fetchActiveOrgDetails();
    } catch (err) {
      console.error(err);
      toast.error("Failed to send invitation.");
    } finally {
      setOrgInviting(false);
    }
  };

  // Remove org member
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
      await fetchActiveOrgDetails();
    } catch (err) {
      console.error(err);
      toast.error("Failed to remove member.");
    }
  };

  // Cancel invitation
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
      await fetchActiveOrgDetails();
    } catch (err) {
      console.error(err);
      toast.error("Failed to cancel invitation.");
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

  const activeOrg = organizations.find((org) => org.id === activeOrgId);

  return (
    <div className="mx-auto max-w-4xl space-y-8 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building className="h-5 w-5 text-gray-500" />
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Organizations
          </h1>
        </div>
        <Button onClick={() => setShowCreateOrgDialog(true)} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Create Organization
        </Button>
      </div>

      {/* Organization List */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Your Organizations
        </h2>
        {isLoading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading organizations...
          </div>
        ) : organizations.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">
            You don't belong to any organizations yet. Create one to get started.
          </p>
        ) : (
          <div className="space-y-2">
            {organizations.map((org) => (
              <div
                key={org.id}
                className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                  org.id === activeOrgId
                    ? "border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20"
                    : "border-gray-200 dark:border-gray-800"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Building className="h-4 w-4 text-gray-400" />
                  <div>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {org.name}
                    </span>
                    {org.slug && (
                      <span className="ml-2 text-xs text-gray-400">
                        ({org.slug})
                      </span>
                    )}
                  </div>
                  {org.id === activeOrgId && (
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      <Check className="mr-1 h-3 w-3" />
                      Active
                    </span>
                  )}
                </div>
                {org.id !== activeOrgId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSwitchOrg(org.id)}
                    disabled={isSwitching === org.id}
                    className="gap-2"
                  >
                    {isSwitching === org.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRightLeft className="h-4 w-4" />
                    )}
                    Switch
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Active Organization Details */}
      {activeOrg && (
        <>
          <Separator />

          <section>
            <h2 className="mb-4 text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              {activeOrg.name} — Members
            </h2>

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
            {orgDetailsLoading ? (
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
        </>
      )}

      {/* Create Organization Dialog */}
      <CreateOrganizationDialog
        open={showCreateOrgDialog}
        onOpenChange={setShowCreateOrgDialog}
      />
    </div>
  );
}
