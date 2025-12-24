import { ExternalServiceError, ValidationError } from "@/lib/error";
import { pool } from "@/server/db/pg";
import { analysePromptsForWorkspace } from "@/server/services/analysis/analysis";
import { askPromptsForWorkspace } from "@/server/services/prompt/prompt";


async function handleJobFailure(job: any, err: any) {
  const attempts = (job.attempts || 0) + 1;
  const maxAttempts = job.max_attempts || 3;

  console.error("Job failed:", {
    jobId: job.id,
    attempts,
    error: err,
  });

  if (attempts >= maxAttempts) {
    await pool.query(
      `INSERT INTO public.job_runs
       (job_id, workspace_id, started_at, finished_at, status, error)
       VALUES ($1, $2, now(), now(), 'failed', $3)`,
      [job.jobId, job.workspaceId, String(err.message || err)]
    );

    await pool.query(
      `UPDATE public.cron_queue
       SET processed = true,
           last_error = $2,
           attempts = $1
       WHERE id = $3`,
      [attempts, String(err.message || err), job.id]
    );
  } else {
    const backoffSeconds = Math.pow(attempts, 2) * 60;

    await pool.query(
      `UPDATE public.cron_queue
       SET attempts = $1,
           next_run_at = now() + ($2 || ' seconds')::interval,
           last_error = $3
       WHERE id = $4`,
      [attempts, backoffSeconds, String(err.message || err), job.id]
    );
  }
}

async function claimNextJob() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      UPDATE public.cron_queue
      SET locked_at = now()
      WHERE id = (
        SELECT id FROM public.cron_queue
        WHERE processed = false
          AND (next_run_at IS NULL OR next_run_at <= now())
        ORDER BY created_at
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING *;
    `);
    return res.rows[0];
  } finally {
    client.release();
  }
}

async function processJob(job: any) {
  if (!job) return;
  
  try {
    if (job.payload?.type === "runPrompts") {
      const workspace_id = job.workspace_id;
    
      const { userId } = job.payload;

      if (!workspace_id || !userId) {
        throw new ValidationError("Invalid job payload: missing workspaceId or userId");
      }
    
      // const res = await askPromptsForWorkspace({
      //   workspaceId: workspace_id,
      //   userId,
      // });
    
      // if(!res || !res.response){
      //   throw new ExternalServiceError("askPromptsForWorkspace returned empty response");
      // }

      // console.log("Ask completed successfully, calling analyzeMetrics...");

      // const analyseRes = await analysePromptsForWorkspace({ 
      //   workspaceId: workspace_id,
      //   userId,
      // });

      // console.log("Analyse Res", analyseRes);
      
      // console.log(
      //   "Successfully processed prompts for workspace:",
      //   workspace_id,
      //   "user:",
      //   userId
      // );
    }

    await pool.query(
      `INSERT INTO public.job_runs (job_id, workspace_id, started_at, finished_at, status, output)
       VALUES ($1, $2, now(), now(), 'success', $3::jsonb)`,
      [job.jobId, job.workspaceId, JSON.stringify({ result: "success" })]
    );

    await pool.query(
      `UPDATE public.cron_queue SET processed = true WHERE id = $1`,
      [job.id]
    );
  } catch (err: any) {
    await handleJobFailure(job, err);
  }
}

async function mainLoop() {
  try {
    while (true) {
      const job = await claimNextJob();
      console.log("Polled job:", job);

      if (job) {
        await processJob(job);
      }

      // Small delay to avoid hammering the database
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  } catch (err) {
    console.error("Cron worker crashed:", err);
    process.exit(1);
  }
}

mainLoop();