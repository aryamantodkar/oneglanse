"use client";

import { useEffect, useState } from "react";
import { Pencil, Trash, Plus } from "lucide-react";
import { api } from "@/trpc/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Competitor } from "@/server/db/types";
import { useSearchParams } from "next/navigation";

export default function CompetitorsPage() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspace") ?? "";

  const { data: brandData, refetch: refetchBrand, isLoading } = api.brand.get.useQuery(
    { workspaceId },
    { enabled: !!workspaceId }
  );

  const updateBrandMutation = api.brand.update.useMutation({ onSuccess: () => refetchBrand() });

  const [brandName, setBrandName] = useState("");
  const [brandDescription, setBrandDescription] = useState("");
  const [brandWebsite, setBrandWebsite] = useState("");

  const [newCompetitorName, setNewCompetitorName] = useState("");
  const [newCompetitorWebsite, setNewCompetitorWebsite] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  useEffect(() => {
    if (!isLoaded && brandData?.data) {
      setBrandName(brandData.data.name || "");
      setBrandWebsite(brandData.data.website || "");
      setBrandDescription(brandData.data.description || "");
      setIsLoaded(true); // prevent future overwrites
    }
  }, [brandData, isLoaded]);
  
  if (isLoading)
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center text-gray-500 animate-pulse">
          <p className="text-lg font-medium">Loading your brand...</p>
          <p className="text-sm mt-1">Hang tight, fetching your workspace data</p>
        </div>
      </div>
    );

  if (!brandData || !brandData.data)
    return (
      <div className="flex items-center justify-center h-screen text-gray-500">
        No brand found for this workspace.
      </div>
    );

  const brand = brandData.data;
  const competitors: Competitor[] = brand.competitors || [];

  const getFaviconUrl = (website?: string) =>
    website ? `https://www.google.com/s2/favicons?sz=32&domain_url=${website}` : null;

  const handleUpdateBrand = () => {
    if (!brandName.trim()) return;
    updateBrandMutation.mutate({
      workspaceId,
      name: brandName,
      description: brandDescription,
      website: brandWebsite.trim() ?? "",
      competitors,
    });

    setIsDialogOpen(false);
  };

  const handleAddCompetitor = () => {
    if (!newCompetitorName.trim()) return;
    const updatedCompetitors = [
      ...competitors,
      {
        id: crypto.randomUUID(),
        name: newCompetitorName.trim(),
        website: newCompetitorWebsite.trim() ?? "",
      },
    ];
    updateBrandMutation.mutate({
      workspaceId,
      name: brand.name,
      description: brand.description ?? "",
      website: brand.website?.trim() ?? "",
      competitors: updatedCompetitors,
    });
    setNewCompetitorName("");
    setNewCompetitorWebsite("");
    setIsAddDialogOpen(false);
  };

  const handleRemoveCompetitor = (id: string) => {
    const updatedCompetitors = competitors.filter((c) => c.id !== id);
    updateBrandMutation.mutate({
      workspaceId,
      name: brand.name,
      description: brand.description ?? "",
      website: brand.website?.trim() ?? "",
      competitors: updatedCompetitors,
    });
  };

  return (
    <div className="w-full min-h-screen p-6 space-y-10">
      {/* Page Title */}
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Your Brand</h1>

      {/* Brand Card */}
      <div className="flex items-center justify-between bg-white shadow-lg rounded-xl p-6">
        <div className="flex items-center gap-4">
          {brand.website && (
            <img
              src={getFaviconUrl(brand.website)!}
              alt={`${brand.name} favicon`}
              className="w-8 h-8 rounded-md"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          )}
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">{brand.name}</h2>
            {brand.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400">{brand.description}</p>
            )}
          </div>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="flex items-center gap-1">
              <Pencil className="w-4 h-4" /> Edit
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Brand</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 mt-2">
                <Input
                    placeholder="Brand Name"
                    value={brandName} // only the state
                    onChange={(e) => setBrandName(e.target.value)}
                />
                <Input
                    placeholder="Website"
                    value={brandWebsite} // only the state
                    onChange={(e) => setBrandWebsite(e.target.value)}
                />
                <Input
                    placeholder="Description"
                    value={brandDescription} // only the state
                    onChange={(e) => setBrandDescription(e.target.value)}
                />
              <Button className="mt-2" onClick={handleUpdateBrand}>
                Save Changes
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Competitors Section */}
      <div className="bg-white shadow-lg rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Competitors</h2>

          {/* Add Competitor Dialog */}
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-1">
                <Plus className="w-8 h-8" /> Add Competitor
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Competitor</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4 mt-2">
                <Input
                  placeholder="Competitor Name"
                  value={newCompetitorName}
                  onChange={(e) => setNewCompetitorName(e.target.value)}
                />
                <Input
                  placeholder="Website (optional)"
                  value={newCompetitorWebsite}
                  onChange={(e) => setNewCompetitorWebsite(e.target.value)}
                />
                <Button className="mt-2" onClick={handleAddCompetitor}>
                  Add
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Competitors List */}
        {competitors.length > 0 ? (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {competitors.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  {c.website && (
                    <img
                      src={getFaviconUrl(c.website)!}
                      alt={`${c.name} favicon`}
                      className="w-5 h-5 rounded-sm"
                      onError={(e) => (e.currentTarget.style.display = "none")}
                    />
                  )}
                  <div className="flex flex-col">
                    <span className="font-medium text-gray-800 dark:text-gray-100">{c.name}</span>
                    {c.website && (
                      <a
                        href={c.website}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
                      >
                        {c.website}
                      </a>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveCompetitor(c.id)}
                >
                  <Trash className="w-4 h-4 text-red-600" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500 dark:text-gray-400">No competitors tracked yet.</p>
        )}
      </div>
    </div>
  );
}