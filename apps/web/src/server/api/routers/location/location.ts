import "server-only";

import fs from "fs";
import path from "path";
import { createTRPCRouter } from "@/server/api/trpc";
import { NotFoundError } from "@onescope/errors";
import { z } from "zod";
import { publicProcedure } from "../../procedures";

// Load countries JSON once at startup
const countriesDataPath = path.join(process.cwd(), "countries.json");
const countriesJson: Record<
	string,
	{ name: string; emoji?: string; states: { name: string; iso2: string }[] }
> = JSON.parse(fs.readFileSync(countriesDataPath, "utf-8"));

export const locationRouter = createTRPCRouter({
	// Fetch all countries
	fetchCountries: publicProcedure.query(async () => {
		return Object.entries(countriesJson).map(([iso2, data]) => ({
			iso2,
			name: data.name,
			emoji: data.emoji,
		}));
	}),

	// Fetch states for a given country
	fetchStates: publicProcedure
		.input(z.object({ countryIso2: z.string() }))
		.query(async ({ input }) => {
			const iso = input.countryIso2.toUpperCase();
			const country = countriesJson[iso];
			if (!country) throw new NotFoundError("Country");
			return country.states.map((s) => ({
				iso2: s.iso2,
				name: s.name,
			}));
		}),
});
