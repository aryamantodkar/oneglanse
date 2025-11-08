import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import fs from "fs";
import path from "path";
import { makeError, makeResponse, safeHandler } from "@/lib/errorHandling/errorHandling";

// Load countries JSON once at startup
const countriesDataPath = path.join(process.cwd(), "countries.json");
const countriesJson: Record<
  string,
  { name: string; emoji?: string; states: { name: string; iso2: string }[] }
> = JSON.parse(fs.readFileSync(countriesDataPath, "utf-8"));

export const locationRouter = createTRPCRouter({
  // Fetch all countries
  fetchCountries: publicProcedure
  .query(async () => {
    return safeHandler(async () => {
      let result = Object.entries(countriesJson).map(([iso2, data]) => ({
        iso2,
        name: data.name,
        emoji: data.emoji,
      }));

      return makeResponse(result, 200, "Fetched all countries successfully.");
    })
  }),

  // Fetch states for a given country
  fetchStates: publicProcedure
    .input(z.object({ countryIso2: z.string() }))
    .query(async ({ input }) => {
      return safeHandler(async () => {
        const iso = input.countryIso2.toUpperCase();
        const country = countriesJson[iso];
        if (!country) return makeError("Country not found.", 404);
        let result = country.states.map((s) => ({
          iso2: s.iso2,
          name: s.name,
        }));

        return makeResponse(result, 200,"Fetched all states successfully.");
      })
    }),
});