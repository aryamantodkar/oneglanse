"use client";

import { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { redirect, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/trpc/react";
import { toast } from "sonner";

export default function BrandPage() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspace") ?? "";
  
  const [formReady, setFormReady] = useState(true);
  const [loading, setLoading] = useState(false);
  const [brandName, setBrandName] = useState("");
  const [brandWebsite, setBrandWebsite] = useState("");
  const [brandDescription, setBrandDescription] = useState("");

  const createBrandMutation = api.brand.create.useMutation();
  const router = useRouter();

  const handleComplete = async () => {
    if (!workspaceId) return toast.error("Workspace ID not available");
    
    setLoading(true);
    try {
      await createBrandMutation.mutateAsync({
        workspaceId,
        name: brandName,
        website: brandWebsite ?? "",
        description: brandDescription ?? ""
      });

      toast.success("Brand added successfully!");

      return router.push(`/dashboard?workspace=${workspaceId}`)
    } catch (err) {
      console.error("Failed to add brand:", err);
      toast.error("Failed to add brand");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {formReady ? (
        <div className="w-full max-w-md">
          <Card>
            <CardHeader>
              <CardTitle>Brand Setup</CardTitle>
              <CardDescription>
                Add your brand information to start tracking.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Brand Name */}
              <div className="space-y-2">
                <Label htmlFor="brand-name">Brand Name</Label>
                <Input
                  id="brand-name"
                  placeholder="e.g. Tesla"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                />
              </div>

              {/* Brand Website */}
              <div className="space-y-2">
                <Label htmlFor="brand-website">Brand Website</Label>
                <Input
                  id="brand-website"
                  placeholder="https://www.example.com"
                  value={brandWebsite}
                  onChange={(e) => setBrandWebsite(e.target.value)}
                />
              </div>

              {/* Brand Description */}
              <div className="space-y-2">
                <Label htmlFor="brand-desc">Brand Description (optional)</Label>
                <Textarea
                  id="brand-desc"
                  placeholder="Briefly describe your brand..."
                  rows={3}
                  value={brandDescription}
                  onChange={(e) => setBrandDescription(e.target.value)}
                />
              </div>
            </CardContent>

            <CardFooter>
              <Button
                onClick={handleComplete}
                disabled={loading || !brandName.trim() || !brandWebsite.trim()}
                className="w-full flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating Brand...
                  </>
                ) : (
                  "Start Tracking"
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-screen gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading Brand Setup</span>
        </div>
      )}
    </div>
  );
}