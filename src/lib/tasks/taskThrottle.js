/**
 * Claims a shared background task slot.
 *
 * Backed by `public.claim_task_run`, which upserts with a `where` guard so only
 * one serverless invocation wins per interval.
 */
export async function claimTaskRun({
  minIntervalSeconds,
  supabase,
  taskName,
}) {
  const { data, error } = await supabase.rpc("claim_task_run", {
    p_min_interval_seconds: minIntervalSeconds,
    p_task_name: taskName,
  });

  if (error) {
    console.error("[task throttle] Could not claim task run", {
      message: error.message,
      taskName,
    });
    return false;
  }

  return data === true;
}

export async function recordTaskResult({ result, supabase, taskName }) {
  const { error } = await supabase
    .from("app_task_runs")
    .update({
      last_finished_at: new Date().toISOString(),
      last_result: result,
      updated_at: new Date().toISOString(),
    })
    .eq("task_name", taskName);

  if (error) {
    console.error("[task throttle] Could not record task result", {
      message: error.message,
      taskName,
    });
  }
}
