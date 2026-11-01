import type { ScheduleModuleOptions } from '@nestjs/schedule';

export type MaintenanceJob =
  | 'AI_EXPIRY'
  | 'CONSULTATION_EXPIRY'
  | 'EARNINGS_RELEASE';

/** Opt-in in every environment; neither a default nor a truthy string is approval. */
export function maintenanceJobEnabled(
  job: MaintenanceJob,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return (
    env.BACKGROUND_JOBS_ENABLED === 'true' &&
    env[`MAINTENANCE_${job}_ENABLED`] === 'true'
  );
}

export function backgroundScheduleOptions(
  env: NodeJS.ProcessEnv = process.env,
): ScheduleModuleOptions {
  const enabled = env.BACKGROUND_JOBS_ENABLED === 'true';
  return { cronJobs: enabled, intervals: enabled, timeouts: enabled };
}
