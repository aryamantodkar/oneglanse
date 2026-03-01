"use client";

import {
  Card,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@oneglanse/ui";
import { getModelFavicon, modelSelectors } from "@oneglanse/utils";
import { Bot } from "lucide-react";
import { useState } from "react";

export function ModelSupportPreview(): React.JSX.Element {
  const [modelFilter, setModelFilter] = useState<string>("All Models");

  return (
    <Card className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-black">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            Multi-provider AI support
          </h3>
          <p className="mt-2 text-xs text-muted-foreground">
            Provider-aware filtering with consistent model icons and naming.
          </p>
        </div>
        <div className="w-full sm:w-52">
          <Select value={modelFilter} onValueChange={setModelFilter}>
            <SelectTrigger className="h-9 w-full rounded-lg border border-gray-200 bg-white text-sm dark:border-gray-800 dark:bg-black">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent className="z-[9999]">
              {modelSelectors.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  <div className="flex items-center gap-2">
                    {value === "All Models" ? (
                      <Bot className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <img
                        src={getModelFavicon(value)}
                        alt={value}
                        className="h-4 w-4 rounded-sm"
                      />
                    )}
                    <span>{label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {modelSelectors
          .filter((entry) => entry.value !== "All Models")
          .map((entry) => {
            const isSelected =
              modelFilter === "All Models" || modelFilter === entry.value;

            return (
              <div
                key={entry.value}
                className={`ui-list-item rounded-xl border px-3.5 py-3 transition-all ${
                  isSelected
                    ? "border-gray-300 bg-white dark:border-gray-700 dark:bg-black"
                    : "border-gray-200/70 bg-gray-50/70 opacity-80 dark:border-gray-800 dark:bg-neutral-950"
                }`}
              >
                <div className="flex items-center gap-2">
                  <img
                    src={getModelFavicon(entry.value)}
                    alt={entry.label}
                    className="h-4 w-4 rounded-sm"
                  />
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {entry.label}
                  </p>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Provider: {entry.value}
                </p>
              </div>
            );
          })}
      </div>
    </Card>
  );
}
