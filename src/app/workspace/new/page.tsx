"use client"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { authClient } from "@lib/auth-client"
import { toast } from "sonner"
import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { redirect, useRouter } from "next/navigation"
import { api } from "@/trpc/react"
import { Label } from "@/components/ui/label"
import { createAuthClient } from "better-auth/react"

const { useSession } = createAuthClient() 

export default function NewWorkspace() {
  const router = useRouter();
  const {
      data: session,
      isPending,
      refetch 
  } = useSession()

  useEffect(() => { 
    console.log("user", session);
    if (!isPending && !session) {
      router.push("/");
    }
  }, [session, isPending, router]);
  
    const [formData, setFormData] = useState({
      workspaceName: "",
      workspaceSlug: "",
    })
    const [loading, setLoading] = useState(false)
    const [error] = useState<string | null>(null)
    const [success] = useState(false)

    const createWorkspaceMutation = api.workspace.create.useMutation({
      onSuccess: async (data) => {
        try {
          await authClient.organization.setActive({
            organizationId: data.org.id,
            organizationSlug: data.workspace.slug,
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
    })
   
    const handleComplete = async () => {
      if (!formData.workspaceSlug || !formData.workspaceName) {
        toast.error("Please fill in all fields");
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
    
        const data = await createWorkspaceMutation.mutateAsync({
          name: formData.workspaceName,
          slug: formData.workspaceSlug,
        });
    
        try {
          await authClient.organization.setActive({
            organizationId: data.org.id,
            organizationSlug: data.workspace.slug,
          });
        } catch (err) {
          console.error("Error setting active organization", err);
          toast.error("Could not set active workspace.");
        }
    
        redirect(`/workspace/${data.workspace.slug}`);
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card>
            <CardHeader>
              <CardTitle>Workspace Setup</CardTitle>
              <CardDescription>
                Create your new workspace with a name and slug.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="workspace-name">Workspace Name</Label>
                <Input
                  className="outline-none"
                  id="workspace-name"
                  placeholder="Enter your workspace name"
                  value={formData.workspaceName}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      workspaceName: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="workspace-slug">Workspace Slug</Label>
                <Input
                  id="workspace-slug"
                  placeholder="workspace-slug"
                  value={formData.workspaceSlug}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      workspaceSlug: e.target.value,
                    }))
                  }
                />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              {success && (
                <p className="text-green-500 flex items-center gap-1 text-sm">
                      Workspace created!
                </p>
              )}
            </CardContent>
          <CardFooter>
          <Button
              onClick={handleComplete}
              disabled={loading}
              className="w-full flex items-center gap-2 cursor-pointer"
          >
              {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
              "Create Workspace"
              )}
          </Button>
          </CardFooter>

          </Card>
        </div>
      </div>
      )
}