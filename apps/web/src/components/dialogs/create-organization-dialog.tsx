"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Button,
  toast,
} from "@onescope/ui";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import { authClient } from "@/lib/auth/auth-client";
import { LocationSelector } from "@/components/location/locationSelector";

interface CreateOrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateOrganizationDialog({
  open,
  onOpenChange,
}: CreateOrganizationDialogProps) {
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

  const createWorkspaceMutation = api.workspace.create.useMutation();

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
      const { data: uniqueSlug, error: slugError } =
        await authClient.organization.checkSlug({ slug: formData.slug });

      if (slugError || !uniqueSlug) {
        toast.error("Slug already exists. Please choose another.");
        return;
      }

      const response = await createWorkspaceMutation.mutateAsync({
        name: formData.name.trim(),
        slug: formData.slug.trim(),
        domain: formData.domain.trim(),
        country: selectedLocation.country,
        region: selectedLocation.regionName || null,
      });

      if (!response?.success || !response.data) {
        toast.error(response?.message ?? "Organization creation failed.");
        return;
      }

      const { workspace, org } = response.data;

      await authClient.organization.setActive({
        organizationId: org.id,
        organizationSlug: workspace.slug,
      });

      toast.success("Organization created!");
      resetForm();
      onOpenChange(false);
      router.refresh();
      router.push(`/dashboard?workspace=${workspace.id}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to create organization.");
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
          <DialogTitle>Create Organization</DialogTitle>
          <DialogDescription>
            Create a new organization with its first workspace.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="org-name">Organization Name</Label>
            <Input
              id="org-name"
              placeholder="My Company"
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-slug">Slug</Label>
            <Input
              id="org-slug"
              placeholder="my-company"
              value={formData.slug}
              onChange={(e) =>
                setFormData({ ...formData, slug: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-domain">Domain</Label>
            <Input
              id="org-domain"
              placeholder="example.com"
              value={formData.domain}
              onChange={(e) =>
                setFormData({ ...formData, domain: e.target.value })
              }
            />
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
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Create"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
