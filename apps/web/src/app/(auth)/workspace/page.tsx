"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  toast,
} from "@onescope/ui";
import { Loader2, ArrowRight } from "lucide-react";
import { api } from "@/trpc/react";
import { authClient } from "@/lib/auth/auth-client";

type JoinSelection = {
  organization: { id: string; name: string; slug: string | null };
  workspaces: { id: string; name: string; slug: string }[];
};

export default function WorkspaceGateway() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [selection, setSelection] = useState<JoinSelection | null>(null);

  const joinMutation = api.workspace.joinByCode.useMutation();

  const handleJoin = async (joinCode: string) => {
    if (!joinCode.trim()) {
      toast.error("Please enter a workspace code.");
      return;
    }

    setSelection(null);

    try {
      const result = await joinMutation.mutateAsync({ code: joinCode.trim() });
      if (!result?.success || !result.data) {
        toast.error(result?.message ?? "Unable to join workspace.");
        return;
      }

      if (result.data.status === "select-workspace") {
        setSelection({
          organization: result.data.organization,
          workspaces: result.data.workspaces,
        });
        return;
      }

      const data = result.data as any;
      const workspace = data.workspace as { id: string; name: string; slug: string };
      const organization = data.organization as { id: string; name: string; slug: string | null };
      await authClient.organization.setActive({
        organizationId: organization.id,
        organizationSlug: organization.slug ?? undefined,
      });
      router.refresh();
      router.push(`/dashboard?workspace=${workspace.id}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message ?? "Unable to join workspace.");
    }
  };

  const handleSelectWorkspace = async (workspaceSlug: string) => {
    if (!selection) return;
    const orgCode = selection.organization.slug ?? selection.organization.id;
    await handleJoin(`${orgCode}/${workspaceSlug}`);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-3xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold text-gray-900">Welcome to your workspace</h1>
          <p className="text-sm text-gray-500">
            Join an existing workspace with a code, or create a new one.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Join Workspace</CardTitle>
              <CardDescription>
                Enter a workspace code shared by your team.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                <div className="space-y-2 rounded-md border border-dashed border-gray-200 p-3">
                  <p className="text-sm text-gray-600">
                    Select a workspace in <strong>{selection.organization.name}</strong>
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

              <Button
                onClick={() => handleJoin(code)}
                disabled={joinMutation.isPending || !code.trim()}
                className="w-full gap-2"
              >
                {joinMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Join Workspace
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Create Workspace</CardTitle>
              <CardDescription>
                Start fresh and create your first workspace.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-500">
                You can invite teammates later from the People tab.
              </p>
              <Button
                onClick={() => router.push("/workspace/new")}
                className="w-full"
              >
                Create New Workspace
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
