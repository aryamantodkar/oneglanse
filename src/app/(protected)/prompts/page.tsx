"use client";
import { api } from "@/trpc/react";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { X, ArrowRight, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";

export default function Prompts() {
  const [prompts, setPrompts] = useState<string[]>([]);
  const [currentPrompt, setCurrentPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspace") ?? "";

  const router = useRouter();
  const storePromptMutation = api.prompt.store.useMutation();
  const askPromptMutation = api.prompt.ask.useMutation();

  const { data } = api.prompt.fetchUserPrompts.useQuery(
    { workspaceId },
    { retry: 2, refetchOnWindowFocus: false }
  );

  useEffect(() => {
    if (data?.prompts) {
      setPrompts(data.prompts);
    }
  }, [data]);

  const addPromptField = () => {
    if (!currentPrompt.trim() || prompts.length >= 5) return;
    setPrompts([...prompts, currentPrompt.trim()]);
    setCurrentPrompt("");
  };

  const removePromptField = (index: number) => {
    setPrompts(prompts.filter((_, i) => i !== index));
  };

  const handleNext = async () => {
    setLoading(true);
    setSuccess(false);
    try {
      if (prompts.length > 0) {
        await storePromptMutation.mutateAsync({
          prompts,
          workspaceId,
        });

        await askPromptMutation.mutateAsync({
          workspaceId,
        });
      }
      setSuccess(true);
      setPrompts([]);
      router.push(`/prompts?workspaceId=${workspaceId}`);
    } catch (err) {
      console.error("Failed to save prompts:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Prompts list */}
      <main className="flex-grow flex flex-col items-center justify-center px-6 py-8 w-full max-w-5xl space-y-4 relative">
        {prompts.length > 0 && (
          <div className="flex flex-col gap-4 w-full">
            {prompts.map((prompt, idx) => (
              <Card key={idx} className="p-2 relative rounded-xl shadow-md hover:shadow-lg transition w-full">
                <CardContent className="p-3 text-gray-800 relative">
                  <p className="text-sm text-gray-500 mb-1 font-medium">Prompt {idx + 1}</p>
                  {prompt}
                  <button
                    type="button"
                    onClick={() => removePromptField(idx)}
                    className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={18} />
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Next button vertically centered right */}
      <div className="absolute top-1/2 right-8 -translate-y-1/2">
        <Button
          type="button"
          onClick={handleNext}
          disabled={loading || prompts.length === 0}
          className="rounded-xl px-6 py-2 bg-gray-900 text-white hover:bg-gray-800 transition disabled:opacity-50"
        >
          {loading ? "Saving..." : <ArrowRight size={48} />}
        </Button>
      </div>

      {/* Bottom input */}
      <div className="sticky bottom-8 w-full p-4 flex items-center gap-3 max-w-6xl mx-auto">
        <Textarea
          value={currentPrompt}
          onChange={(e) => setCurrentPrompt(e.target.value)}
          placeholder="Type your prompt..."
          className="flex-1 min-w-[600px] bg-white resize-none rounded-xl transition px-4 py-2 text-lg focus:outline-none focus:ring-0 focus:border-none"
          rows={3}
        />
        <div className="flex gap-2">
          {prompts.length < 5 && (
            <Button
              type="button"
              variant="outline"
              onClick={addPromptField}
              className="rounded-xl px-4 py-2 flex items-center justify-center"
              disabled={!currentPrompt.trim()}
            >
              <Plus size={20} />
            </Button>
          )}
        </div>
      </div>

      {success && (
        <p className="fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-green-100 text-green-800 px-5 py-2 rounded-full shadow-md font-medium select-none">
          Prompts saved successfully! ✅
        </p>
      )}
    </div>
  );
}