"use client";

import { getModelFavicon, modelSelectors } from "@oneglanse/utils";
import { Bot } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select.js";

export function ProviderModelSelect({
  value,
  onValueChange,
  triggerClassName,
  contentClassName,
  placeholder = "Select Model",
}: {
  value: string;
  onValueChange: (value: string) => void;
  triggerClassName?: string;
  contentClassName?: string;
  placeholder?: string;
}): React.JSX.Element {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={triggerClassName}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={contentClassName}>
        {modelSelectors.map(({ value: modelValue, label }) => (
          <SelectItem key={modelValue} value={modelValue}>
            <div className="flex items-center gap-2">
              {modelValue === "All Models" ? (
                <Bot className="h-4 w-4 text-muted-foreground" />
              ) : (
                <img src={getModelFavicon(modelValue)} alt={modelValue} className="h-4 w-4 rounded-sm" />
              )}
              <span>{label}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
