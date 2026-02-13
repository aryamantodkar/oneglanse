"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Button,
  Input,
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
} from "@onescope/ui";
import {
  Loader2,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { api } from "@/trpc/react";

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
  const joinInfoQuery = api.workspace.getJoinInfo.useQuery(
    { workspaceId },
    { enabled: !!workspaceId }
  );
  const joinInfo = joinInfoQuery.data?.data;
  const joinInfoLoading = joinInfoQuery.isLoading;

  const addWsMemberMutation = api.workspace.addMember.useMutation();
  const removeWsMemberMutation = api.workspace.removeMember.useMutation();

  const handleCopy = async (value: string, label: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied to clipboard.`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to copy to clipboard.");
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

      if (result.data?.status === "not-found") {
        toast.error("User not found. Share your workspace code so they can join after signing up.");
        setWsInviteEmail("");
        return;
      }

      if (result.data?.status === "already-member") {
        toast.success("This user is already a workspace member.");
        setWsInviteEmail("");
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

  if (wsMembersQuery.isError) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-sm text-gray-500">Unable to load workspace members.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 py-6">
      {/* Workspace Members Section */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Workspace Members
          </h2>
        </div>

        {/* Join codes */}
        <div className="mb-4 rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Invite with a code</p>
            <p className="text-xs text-gray-500">
              Share the workspace code to let teammates join instantly.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {joinInfoLoading ? (
              <>
                <Skeleton className="h-9 w-[260px]" />
                <Skeleton className="h-9 w-16" />
              </>
            ) : (
              <>
                <Input
                  readOnly
                  value={joinInfo?.workspaceCode ?? ""}
                  placeholder="Workspace code"
                  className="max-w-md"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(joinInfo?.workspaceCode ?? "", "Workspace code")}
                  disabled={!joinInfo?.workspaceCode}
                >
                  Copy
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Add member form */}
        <div className="mb-4 flex items-center gap-2">
          <Input
            placeholder="Email address (we'll invite if needed)"
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
          <div className="space-y-3 py-6">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={`ws-member-skeleton-${idx}`}
                className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3"
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
