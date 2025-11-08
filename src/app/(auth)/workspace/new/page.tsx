"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { redirect, useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import { authClient } from "@/lib/auth/auth-client";
import { LocationSelector } from "@/components/location/locationSelector";

export default function NewWorkspace() {
  const [formData, setFormData] = useState({
    workspaceName: "",
    workspaceSlug: "",
  });

  const [selectedLocation, setSelectedLocation] = useState<{
    country: string;
    countryName: string;
    region?: string;
    regionName?: string;
  }>({ country: "", countryName: "" });

  const [loading, setLoading] = useState(false);
  const router = useRouter();
  
  // Fetch countries first
  const countriesQuery = api.location.fetchCountries.useQuery();
  
  // Consider loading if countries are not yet fetched
  const formReady = !!countriesQuery.data;

  const createWorkspaceMutation = api.workspace.create.useMutation({
    onSuccess: async (response) => {
      try {
        if (!response?.success || !response.data) {
          toast.error(response?.message ?? "Workspace creation failed");
          return;
        }
      
        const { workspace, org } = response.data;      
        
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

      const response = await createWorkspaceMutation.mutateAsync({
        name: formData.workspaceName.trim(),
        slug: formData.workspaceSlug.trim(),
        country: selectedLocation.country,
        region: selectedLocation.regionName || null,
      });
  
      if (!response?.success || !response.data) {
        toast.error(response?.message ?? "Workspace creation failed");
        return;
      }
    
      const { workspace, org } = response.data;  

      try {
        await authClient.organization.setActive({
          organizationId: org.id,
          organizationSlug: workspace.slug,
        });
      } catch (err) {
        console.error("Error setting active organization", err);
        toast.error("Could not set active workspace.");
      }

      return router.push(`/brand?workspace=${workspace.id}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLocationSelect = (loc: any) => {
    setSelectedLocation(loc);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {formReady ? (
        <div className="w-full max-w-md">
          <Card>
            <CardHeader>
              <CardTitle>Workspace Setup</CardTitle>
              <CardDescription>
                Create your new workspace with a name, slug, and location.
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

              <div className="space-y-2">
                <Label htmlFor="workspace-location">Workspace Location</Label>
                <LocationSelector onSelect={handleLocationSelect} />
                <p className="text-sm text-gray-500 mt-1">
                  { selectedLocation?.regionName
                    ? `Prompts in this workspace will run inside ${selectedLocation.regionName}, ${selectedLocation.countryName}.`
                    : `Prompts in this workspace will run inside ${selectedLocation.countryName}.`}
                </p>
              </div>
            </CardContent>

            <CardFooter>
              <Button
                onClick={handleComplete}
                disabled={
                  loading ||
                  !formData.workspaceName.trim() ||
                  !formData.workspaceSlug.trim()
                }
                className="w-full flex items-center gap-2 cursor-pointer"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Workspace"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-screen gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading Workspace Setup</span>
        </div>
      )}
    </div>
  );
}