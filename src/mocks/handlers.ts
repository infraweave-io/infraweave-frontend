import { http, HttpResponse } from 'msw';
import { modules } from './modules';
import { projects } from './projects';
import { policies } from './policies';
import { stacks } from './stacks';
import { providers } from './providers';
import {
  deployments_123808927999_eu_central_1,
  deployments_123808927999_us_west_2,
  deployments_123808927998_eu_central_1,
  deployments_123808927998_us_west_2,
  deployments_123808927997_eu_central_1,
  deployments_123808927997_us_west_2,
} from './deployments';

const DEPLOYMENTS_BY_PROJECT: Record<string, Record<string, any[]>> = {
  '123808927999': {
    'us-west-2': deployments_123808927999_us_west_2,
    'eu-central-1': deployments_123808927999_eu_central_1,
  },
  '123808927998': {
    'us-west-2': deployments_123808927998_us_west_2,
    'eu-central-1': deployments_123808927998_eu_central_1,
  },
  '123808927997': {
    'us-west-2': deployments_123808927997_us_west_2,
    'eu-central-1': deployments_123808927997_eu_central_1,
  },
};

// Match requests to any origin (handles both direct and proxied API calls)
const backendBaseUrl = '*';

// Helper to create a handler for the backend URL
const createHandler = (
  method: 'get' | 'post' | 'put' | 'delete',
  endpoint: string,
  handler: Parameters<(typeof http)[typeof method]>[1],
) => {
  return [http[method](`${backendBaseUrl}${endpoint}`, handler)];
};

export const handlers = [
  // ============= DEPLOYMENTS =============
  // Returns mock deployments per project ID and region
  http.get(`${backendBaseUrl}/api/v1/deployments/:project/:region`, ({ params }) => {
    const projectIds = String(params.project).split(',');
    const region = String(params.region);
    const result = projectIds.flatMap((id) => DEPLOYMENTS_BY_PROJECT[id]?.[region] ?? []);
    return HttpResponse.json(result);
  }),
  http.get(`${backendBaseUrl}/api/v1/deployments/module/:project/:region/:module`, ({ params }) => {
    const projectIds = String(params.project).split(',');
    const region = String(params.region);
    const module = String(params.module);
    const result = projectIds.flatMap((id) =>
      (DEPLOYMENTS_BY_PROJECT[id]?.[region] ?? []).filter((d: any) => d.module === module),
    );
    return HttpResponse.json(result);
  }),
  ...createHandler('get', '/api/v1/deployment/123808927999/eu-central-1/dev/ec2_instance_1', () =>
    HttpResponse.json(deployments_123808927999_eu_central_1[0]),
  ),
  ...createHandler('get', '/api/v1/deployment/123808927999/us-west-2/dev/bucket_collection_1', () =>
    HttpResponse.json(deployments_123808927999_us_west_2[0]),
  ),
  ...createHandler(
    'get',
    '/api/v1/deployment/123808927999/us-west-2/playground%2Finfraweave_cli/s3bucket%2Fmy-s3bucket22',
    () => HttpResponse.json(deployments_123808927999_us_west_2[1]),
  ),

  // ============= LOGS =============
  ...createHandler('get', '/api/v1/logs/:project/:region/:jobId', ({ request }) => {
    const url = new URL(request.url);
    const nextToken = url.searchParams.get('next_token');

    // Simulate paginated logs with AWS CloudWatch-style tokens
    if (!nextToken) {
      // First page - start
      return HttpResponse.json({
        logs: 'Starting deployment...\nInitializing resources...\nApplying configuration...\n',
        nextBackwardToken: 'b/39327501774637644981962899437594992369823208685171441664/s',
        nextForwardToken: 'f/39327502348279713723766118537215016332652344905511927820/s',
      });
    } else if (nextToken.startsWith('b/')) {
      // Going backwards - return older logs
      return HttpResponse.json({
        logs: 'Pre-deployment checks...\nLoading configuration...\n',
        // No nextBackwardToken means we've reached the beginning
        nextForwardToken: 'f/39327502348279713723766118537215016332652344905511927819/s',
      });
    } else if (nextToken.startsWith('f/')) {
      // Going forwards - return newer logs or empty if caught up
      const tokenNum = parseInt(nextToken.split('/')[1]);
      // eslint-disable-next-line no-loss-of-precision
      const baseNum = 39327502348279713723766118537215016332652344905511927820;

      if (tokenNum <= baseNum) {
        // Still has new logs
        return HttpResponse.json({
          logs: 'Creating resources...\nValidating setup...\n',
          nextBackwardToken: 'b/39327501774637644981962899437594992369823208685171441665/s',
          nextForwardToken: 'f/39327502348279713723766118537215016332652344905511927821/s',
        });
      }
      // Caught up - no new logs
      return HttpResponse.json({
        logs: '',
        nextBackwardToken: 'b/39327501774637644981962899437594992369823208685171441666/s',
        nextForwardToken: 'f/39327502348279713723766118537215016332652344905511927821/s',
      });
    }
    // Unknown token - return empty
    return HttpResponse.json({ logs: '' });
  }),

  // ============= EVENTS =============
  ...createHandler('get', '/api/v1/events/123808927999/eu-central-1/dev/ec2_instance_1', () =>
    HttpResponse.json([
      {
        PK: 'DEPLOYMENT#123808927999::eu-central-1::dev::ec2_instance_1',
        SK: 'EVENT#2024-11-10T10:30:00.000Z',
        deployment_id: 'ec2_instance_1',
        environment: 'dev',
        epoch: Date.now() - 3600000,
        event_type: 'DEPLOYMENT',
        job_id: 'job-123',
        status: 'successful',
        change_type: 'APPLY',
        initiated_by: 'user@example.com',
      },
    ]),
  ),
  ...createHandler('get', '/api/v1/events/123808927999/us-west-2/dev/bucket_collection_1', () =>
    HttpResponse.json([
      {
        PK: 'DEPLOYMENT#123808927999::us-west-2::dev::bucket_collection_1',
        SK: 'EVENT#2024-11-10T10:30:00.000Z',
        deployment_id: 'bucket_collection_1',
        environment: 'dev',
        epoch: Date.now() - 3600000,
        event_type: 'DEPLOYMENT',
        job_id: 'job-456',
        status: 'successful',
        change_type: 'APPLY',
        initiated_by: 'user@example.com',
      },
    ]),
  ),

  // ============= MODULES =============
  ...createHandler('get', '/api/v1/modules', () => HttpResponse.json(modules)),
  ...createHandler('get', '/api/v1/modules/versions/dev/s3bucket', () =>
    HttpResponse.json([
      modules[0], // dev test-11
      modules[3], // dev test-12
    ]),
  ),
  ...createHandler('get', '/api/v1/modules/versions/beta/s3bucket', () =>
    HttpResponse.json([
      modules[1], // beta test-3
    ]),
  ),
  ...createHandler('get', '/api/v1/modules/versions/dev/ec2', () =>
    HttpResponse.json([
      modules[2], // dev some_branch-5
    ]),
  ),
  ...createHandler('get', '/api/v1/module/dev/s3bucket/0.0.36-dev%2Btest.11', () =>
    HttpResponse.json(modules[0]),
  ),
  ...createHandler('get', '/api/v1/module/dev/s3bucket/0.0.36-dev%2Btest.12', () =>
    HttpResponse.json(modules[3]),
  ),
  ...createHandler('get', '/api/v1/module/beta/s3bucket/0.0.36-beta%2Btest.3', () =>
    HttpResponse.json(modules[1]),
  ),
  ...createHandler('get', '/api/v1/module/dev/ec2/0.0.2-dev%2Bsome_branch.5', () =>
    HttpResponse.json(modules[2]),
  ),
  ...createHandler('get', '/api/v1/module/dev/ec2/0.0.15-dev%2Bmain.9', () =>
    HttpResponse.json(modules[2]),
  ),
  // ============= STACKS =============
  ...createHandler('get', '/api/v1/stacks', () => HttpResponse.json(stacks)),
  ...createHandler('get', '/api/v1/modules/versions/dev/bucketcollection', () =>
    HttpResponse.json([
      stacks[0], // dev 0.0.15-dev+main.9
    ]),
  ),
  ...createHandler('get', '/api/v1/modules/versions/dev/websiterunner', () =>
    HttpResponse.json([
      stacks[1], // dev 0.0.15-dev+main.6
    ]),
  ),
  ...createHandler('get', '/api/v1/stack/dev/bucketcollection/0.0.15-dev%2Bmain.9', () =>
    HttpResponse.json(stacks[0]),
  ),
  ...createHandler('get', '/api/v1/stack/dev/websiterunner/0.0.15-dev%2Bmain.6', () =>
    HttpResponse.json(stacks[1]),
  ),
  // Module endpoints for stacks (treat stacks as modules)
  ...createHandler('get', '/api/v1/module/dev/bucketcollection/0.0.15-dev%2Bmain.9', () =>
    HttpResponse.json(stacks[0]),
  ),
  ...createHandler('get', '/api/v1/module/dev/websiterunner/0.0.15-dev%2Bmain.6', () =>
    HttpResponse.json(stacks[1]),
  ),
  // ============= POLICIES =============
  ...createHandler('get', '/api/v1/policies/stable', () => HttpResponse.json(policies)),
  ...createHandler('get', '/api/v1/policy/aws/allowed-regions/0.1.2', () =>
    HttpResponse.json(policies[0]),
  ),
  ...createHandler('get', '/api/v1/policy/aws/s3-naming-format/0.0.3', () =>
    HttpResponse.json(policies[1]),
  ),
  // ============= PROJECTS =============
  ...createHandler('get', '/api/v1/projects', () => HttpResponse.json(projects)),

  // ============= PROVIDERS =============
  ...createHandler('get', '/api/v1/providers', () => HttpResponse.json(providers)),
  ...createHandler('get', '/api/v1/provider/stable/aws-5/0.0.2', () =>
    HttpResponse.json(providers[0]),
  ),
  ...createHandler('get', '/api/v1/provider/stable/aws-5/0.0.2/download', () =>
    HttpResponse.json({ url: 'https://example.com/dummy.zip' }),
  ),

  // ============= REAPPLY =============
  ...createHandler(
    'post',
    '/api/v1/deployment/reapply/:project/:region/:environment/:deploymentId',
    () => HttpResponse.json({ job_id: 'mock-job-reapply-1', status: 'requested' }),
  ),

  // ============= CATCH-ALL HANDLERS (return empty arrays for unmatched endpoints) =============
  // These should be last to act as fallbacks
  http.get(`${backendBaseUrl}/api/v1/events/:project/:region/:environment/:deploymentId`, () =>
    HttpResponse.json([]),
  ),
];
