import { clickhouse, db, schema } from "@/server/db/index";
import type { CompetitorInput } from "@/server/db/types";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { AuthError, fail, NotFoundError, ok, ValidationError } from "@/lib/error";
import { analyzeResponse } from "@/lib/llm/analyzeResponse";
import { v4 as uuidv4 } from "uuid";
import { eq, isNull, and } from "drizzle-orm";
import { getWorkspaceById } from "../workspace/workspace";
import { getCompetitors } from "@/lib/llm/getCompetitors";

export async function analyseCompetitorsForWorkspace(args: {
    workspaceId: string;
    userId: string;
  }) {
    const { workspaceId, userId } = args;
  
    if (!userId) {
      throw new AuthError("User Id is undefined.");
    }
    
    if (!workspaceId || workspaceId.trim() === "") {
      throw new ValidationError("Workspace ID is undefined.");
    }

    const workspace = await getWorkspaceById({ workspaceId, userId });

    if (!workspace) {
        throw new NotFoundError(`Workspace with ID ${workspaceId} not found.`);
    }

    const brandData: CompetitorInput = {
        name: workspace.name,
        slug: workspace.slug,
        domain: workspace.domain
    }
  
    // const competitorsResult = await getCompetitors(brandData);

    // if (!competitorsResult.data) {
    //     throw new Error("Analysis failed");
    //   }
  
    //   const competitors = competitorsResult.data.competitors;

    // MOCK DATA
    const filePath = path.join(process.cwd(), "mockData", "competitors.json");
    const rawData = fs.readFileSync(filePath, "utf8");
    const competitorsResult: CompetitorInput[] = JSON.parse(rawData);

    const competitors = competitorsResult;

    // LOGGER
    // const logPath = path.join(process.cwd(), "mockData", "competitors.json");
    // fs.writeFileSync(logPath, JSON.stringify(competitors, null, 2));

    await db.insert(schema.competitors).values(
        competitors.map((c) => ({
          id: crypto.randomUUID(),
          workspaceId: workspaceId,
          name: c.name,
          slug: c.slug,
          domain: c.domain,
          source: "ai_suggested",
          status: "suggested",
        }))
    ).onConflictDoNothing();
  }


  export async function fetchCompetitorsForWorkspace(args: {
    workspaceId: string;
    userId: string;
  }) {
    const { workspaceId, userId } = args;
  
    if (!userId) {
      throw new AuthError("User Id is undefined.");
    }
    
    if (!workspaceId || workspaceId.trim() === "") {
      throw new ValidationError("Workspace ID is undefined.");
    }

    const competitors = await db
        .select()
        .from(schema.competitors)
        .where(eq(schema.competitors.workspaceId, workspaceId))
        .execute();

    return competitors;
  }

  