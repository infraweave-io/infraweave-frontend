import { Deployment } from '../types/Deployment';

/** Shared so every view agrees on how many deployments of a module are failing. */
const FAILURE_STATUSES = ['failed', 'error', 'failure', 'timed_out', 'cancelled', 'rolled_back'];

const SUCCESS_STATUSES = ['successful', 'success', 'active'];

const RUNNING_STATUSES = [
  'requested',
  'initiated',
  'in-progress',
  'in_progress',
  'running',
  'pending',
];

export type StatusKind = 'success' | 'failed' | 'running' | 'unknown';

/** Classifies by status alone, for colouring; `isFailedDeployment` also counts error text. */
export const statusKind = (status: string | undefined): StatusKind => {
  const normalised = (status || '').toLowerCase();
  // The runner suffixes the failing step (failed_init, failed_plan, ...), so match the prefix.
  if (FAILURE_STATUSES.includes(normalised) || normalised.startsWith('failed_')) return 'failed';
  if (SUCCESS_STATUSES.includes(normalised)) return 'success';
  if (RUNNING_STATUSES.includes(normalised)) return 'running';
  return 'unknown';
};

/**
 * Error text counts whatever the status: a run can end on an unlisted status with the
 * failure recorded alongside, and would otherwise read as healthy.
 */
export const isFailedDeployment = (
  deployment: Pick<Deployment, 'status' | 'error_text'>,
): boolean =>
  statusKind(deployment.status) === 'failed' || (deployment.error_text || '').trim().length > 0;
