import { ChangeRecord, ResourceChange } from '../types/Log';

const HOUR = 3_600_000;
const now = Date.now();

const bucket = (name: string, action: string, changes?: ResourceChange['changes']) =>
  ({
    action,
    address: `aws_s3_bucket.${name}`,
    resource_type: 'aws_s3_bucket',
    name,
    changes,
  }) satisfies ResourceChange;

// Plan output of the latest apply. It mixes tag-only updates, a real update, a create and an
// unchanged resource, so the "Hide tag-only changes" filter has something to hide and to keep.
const latestApplyChanges: ResourceChange[] = [
  bucket('logs', 'update', {
    tags: { before: { team: 'platform' }, after: { team: 'platform', owner: 'infra' } },
    'tags_all.owner': { before: null, after: 'infra' },
  }),
  bucket('assets', 'update', {
    tags_all: { before: { team: 'platform' }, after: { team: 'platform', owner: 'infra' } },
  }),
  bucket('data', 'update', {
    versioning: { before: false, after: true },
    tags: { before: { team: 'platform' }, after: { team: 'platform', owner: 'infra' } },
  }),
  bucket('backups', 'create', {
    bucket: { before: null, after: 'backups-dev' },
    acl: { before: null, after: 'private' },
  }),
  bucket('archive', 'no-op'),
];

const firstApplyChanges: ResourceChange[] = [
  bucket('logs', 'create', { bucket: { before: null, after: 'logs-dev' } }),
  bucket('assets', 'create', { bucket: { before: null, after: 'assets-dev' } }),
  bucket('data', 'create', { bucket: { before: null, after: 'data-dev' } }),
];

const record = (
  jobId: string,
  changeType: string,
  hoursAgo: number,
  moduleVersion: string,
  resourceChanges: ResourceChange[],
): ChangeRecord => ({
  job_id: jobId,
  change_type: changeType,
  status: 'successful',
  module_version: moduleVersion,
  epoch: now - hoursAgo * HOUR,
  timestamp: new Date(now - hoursAgo * HOUR).toISOString(),
  variables: { bucket_name: 'demo', versioning: changeType === 'APPLY' && hoursAgo < 10 },
  resource_changes: resourceChanges,
  plan_std_output: `Plan: ${resourceChanges.length} resources.`,
});

// The latest apply shares its job ID with the `bucket_collection_1` events fixture in
// handlers.ts. Otherwise the event shows as a newer row without a Changes button.
export const mockChangeRecords: ChangeRecord[] = [
  record('job-456', 'APPLY', 1, '0.0.15-dev+main.9', latestApplyChanges),
  record('job-plan-3', 'PLAN', 2, '0.0.15-dev+main.9', latestApplyChanges),
  record('job-apply-2', 'APPLY', 30, '0.0.15-dev+main.6', firstApplyChanges.slice(0, 2)),
  record('job-apply-1', 'APPLY', 80, '0.0.15-dev+main.6', firstApplyChanges),
];

/** `mutate` is the backend's name for apply and destroy records. */
export const changeRecordsOfType = (changeType: string | null): ChangeRecord[] => {
  if (!changeType) return mockChangeRecords;
  const wanted = changeType.toLowerCase();
  return mockChangeRecords.filter((r) => {
    const type = (r.change_type ?? '').toLowerCase();
    return wanted === 'mutate' ? type === 'apply' || type === 'destroy' : type === wanted;
  });
};

export const findChangeRecord = (jobId: string): ChangeRecord | undefined =>
  mockChangeRecords.find((r) => r.job_id === jobId);
