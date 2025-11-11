import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import fs from "fs";
import path from "path";
import { fail, ok, safeHandler } from "@/server/error";

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

      return ok(result, "All countries fetched successfully.");
    })
  }),

  // Fetch states for a given country
  fetchStates: publicProcedure
    .input(z.object({ countryIso2: z.string() }))
    .query(async ({ input }) => {
      return safeHandler(async () => {
        const iso = input.countryIso2.toUpperCase();
        const country = countriesJson[iso];
        if (!country) return fail("Could not fetch country from the list.", 404);
        let result = country.states.map((s) => ({
          iso2: s.iso2,
          name: s.name,
        }));

        return ok(result, "All states fetched successfully.");
      })
    }),
});