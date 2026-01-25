"use client";
import { useEffect, useState } from "react";
import { api } from "@/trpc/react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function LocationSelector({ onSelect }: { onSelect: (loc: any) => void }) {
  const [countries, setCountries] = useState<{ iso2: string; name: string; emoji?: string }[]>([]);
  const [regions, setRegions] = useState<{ iso2: string; name: string }[]>([]);
  const [selectedCountry, setSelectedCountry] = useState(""); // default
  const [selectedRegion, setSelectedRegion] = useState("");

  const countriesQuery = api.location.fetchCountries.useQuery();
  const statesQuery = api.location.fetchStates.useQuery(
    { countryIso2: selectedCountry },
    { enabled: !!selectedCountry } 
  );

  useEffect(() => {
    if (countriesQuery.data?.data) {
      setCountries(countriesQuery.data.data);
    }
  }, [countriesQuery.data]);

  // Reset region whenever country changes
  useEffect(() => {
    setSelectedRegion(""); // reset region
  }, [selectedCountry]);

  // Set regions when statesQuery changes
  useEffect(() => {
    if (statesQuery.data?.data) {
      setRegions(statesQuery.data.data);
    } else {
      setRegions([]);
    }
  }, [statesQuery.data]);

  // Call onSelect only when selection changes
  useEffect(() => {
    onSelect({
      country: selectedCountry || null,
      countryName: countries.find(c => c.iso2 === selectedCountry)?.name || null,
      region: selectedRegion || null,
      regionName: regions.find(r => r.iso2 === selectedRegion)?.name || null,
    });
  }, [selectedCountry, selectedRegion]); // ONLY depend on selections

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="w-full">
        <label className="text-sm text-gray-500 mb-1 block">Select Country:</label>
        <Select value={selectedCountry} onValueChange={setSelectedCountry}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choose a country..." />
          </SelectTrigger>
          <SelectContent className="w-full max-h-72 overflow-y-auto">
          {countries.map((c) => (
            <SelectItem key={c.iso2} value={c.iso2}>
                {/* Text node for Radix search */}
                <span className="sr-only">{c.name}</span>
                {/* Visual layout */}
                <div className="flex items-center gap-2">
                {c.emoji && <span className="text-lg">{c.emoji}</span>}
                <span>{c.name}</span>
                </div>
            </SelectItem>
          ))}
          </SelectContent>
        </Select>
      </div>

      <div className="w-full">
        <label className="text-sm text-gray-500 mb-1 block">Select Region:</label>
        <Select
          value={selectedRegion}
          onValueChange={setSelectedRegion}
          disabled={!regions.length}
        >
          <SelectTrigger className="w-full">
            <SelectValue
              placeholder={regions.length ? "Choose a region..." : "No regions available"}
            />
          </SelectTrigger>
          <SelectContent className="w-full max-h-72 overflow-y-auto">
            {regions.map((r) => (
              <SelectItem key={r.iso2} value={r.iso2}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}