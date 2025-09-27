"use client";
import { useState } from "react";
import { api } from "@/trpc/react";

interface AnalyticsEntry {
  brand: string;
  source: string;
  snippet: string;
  sentiment: -1 | 0 | 1;
  position: number;
  aggSentiment?: number;
  avgPosition?: number;
  visibility?: number;
}

export default function PromptInput({ workspaceId }: { workspaceId: string }) {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState<AnalyticsEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const askPrompt = api.prompt.ask.useMutation({
    onSuccess: (data) => {
      try {
        console.log("Response Analysis",data);
      } catch (err) {
        console.error("Failed to parse analytics:", err);
        setResponse([]);
      }
      setLoading(false);
    },
    onError: (err) => {
      console.error(err);
      setLoading(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setLoading(true);
    askPrompt.mutate({ query: prompt });
  };

  return (
    <div className="max-w-6xl mx-auto mt-10 p-8 bg-white shadow-lg rounded-xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Type your prompt..."
          className="w-full h-28 p-4 border rounded-lg focus:ring-2 focus:ring-blue-400 resize-none shadow-sm text-lg"
        />

        <button
          type="submit"
          disabled={loading}
          className="self-end bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? "Thinking..." : "Submit"}
        </button>
      </form>

      {loading && <div className="mt-6 text-gray-500 text-center">Fetching AI insights...</div>}

      {response.length > 0 && (
        <div className="mt-10 overflow-x-auto">
          <h2 className="font-bold text-xl mb-6 text-gray-800">📊 Brand Analytics</h2>
          <table className="w-full border border-gray-200 rounded-lg shadow-sm">
            <thead>
              <tr className="bg-gray-100 border-b text-gray-700">
                <th className="p-3 text-left w-1/6">Brand</th>
                <th className="p-3 text-left w-1/5">Source</th>
                <th className="p-3 text-center w-1/12">Sentiment</th>
                <th className="p-3 text-center w-1/12">Position</th>
                <th className="p-3 text-center w-1/12">Visibility</th>
              </tr>
            </thead>
            <tbody>
              { response && response.map((entry, idx) => (
                <tr key={idx} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium">{entry.brand}</td>
                  <td className="p-3 text-blue-600">{entry.source}</td>
                  <td
                    className={`p-3 text-center font-bold ${
                      entry.sentiment === 1
                        ? "text-green-600"
                        : entry.sentiment === -1
                        ? "text-red-600"
                        : "text-gray-500"
                    }`}
                  >
                    {entry.sentiment}
                  </td>
                  <td className="p-3 text-center">{entry.position}</td>
                  <td className="p-3 text-center">{entry.visibility} %</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}