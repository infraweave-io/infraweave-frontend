import { delay, http, HttpResponse } from 'msw';
import { modules } from './modules';
import { projects } from './projects';
import { policies } from './policies';
import { stacks } from './stacks';
import { changeRecordsOfType, findChangeRecord } from './changeRecords';
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
  // Token-scoped: returns the module's deployments in every project
  http.get(`${backendBaseUrl}/api/v1/deployments/module/:region/:module`, ({ params }) => {
    const region = String(params.region);
    const module = String(params.module);
    const result = Object.values(DEPLOYMENTS_BY_PROJECT).flatMap((byRegion: any) =>
      (byRegion[region] ?? []).filter((d: any) => d.module === module),
    );
    return HttpResponse.json(result);
  }),
  // Every deployment in a region, across projects (Adoption & Health views)
  http.get(`${backendBaseUrl}/api/v1/fleet/deployments/:region`, ({ params }) => {
    const region = String(params.region);
    const result = Object.values(DEPLOYMENTS_BY_PROJECT).flatMap(
      (byRegion: any) => byRegion[region] ?? [],
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

  // ============= CHANGE RECORDS =============
  http.get(
    `${backendBaseUrl}/api/v1/change_records/:project/:region/:environment/:deploymentId`,
    ({ params, request }) =>
      HttpResponse.json(
        changeRecordsOfType(new URL(request.url).searchParams.get('change_type')).map((r) => ({
          ...r,
          deployment_id: String(params.deploymentId),
        })),
      ),
  ),
  http.get(
    `${backendBaseUrl}/api/v1/change_record/:project/:region/:environment/:deploymentId/:jobId/:changeType`,
    ({ params }) => {
      const found = findChangeRecord(String(params.jobId));
      return found
        ? HttpResponse.json({ ...found, deployment_id: String(params.deploymentId) })
        : new HttpResponse(null, { status: 404 });
    },
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
  ...createHandler('get', '/api/v1/stacks/versions/dev/bucketcollection', () =>
    HttpResponse.json([
      stacks[0], // dev 0.0.15-dev+main.9
    ]),
  ),
  ...createHandler('get', '/api/v1/stacks/versions/dev/websiterunner', () =>
    HttpResponse.json([
      stacks[1], // dev 0.0.15-dev+main.6
    ]),
  ),
  // Module version endpoints for stacks (some views still use the module path)
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
  ...createHandler('post', '/api/v1/reapply', () =>
    HttpResponse.json({ job_id: 'mock-job-reapply-1', status: 'requested' }),
  ),

  // ============= CATCH-ALL HANDLERS (return empty arrays for unmatched endpoints) =============
  // These should be last to act as fallbacks
  http.get(`${backendBaseUrl}/api/v1/events/:project/:region/:environment/:deploymentId`, () =>
    HttpResponse.json([]),
  ),
  // Every deployment's cost in an account, and per resource: made-up amounts that stay the same
  // between loads, with every fourth deployment missing, as Cost Explorer omits those that cost
  // nothing.
  // Cost Explorer takes a while per account; staggered so the page's progress bar has something
  // to show.
  http.get(`${backendBaseUrl}/api/v1/costs/:project/:region`, async ({ params, request }) => {
    await delay(400 + (mockHash(String(params.project)) % 1600));
    return mockAccountCosts(String(params.project), new URL(request.url).searchParams);
  }),
  http.get(`${backendBaseUrl}/api/v1/deployments/history/:project/:region`, ({ params, request }) =>
    HttpResponse.json(
      new URL(request.url).searchParams.get('type') === 'deleted'
        ? (MOCK_DELETED_DEPLOYMENTS[String(params.project)] ?? []).filter(
            (d) =>
              d.region === String(params.region) &&
              (listParam(new URL(request.url).searchParams, 'deployment_ids').length === 0 ||
                listParam(new URL(request.url).searchParams, 'deployment_ids').includes(
                  d.deployment_id,
                )),
          )
        : [],
    ),
  ),
  // The tag keys Cost Explorer has cost for, as its own Group by > Tag list shows them.
  http.get(`${backendBaseUrl}/api/v1/cost_tags/:project/:region`, ({ params }) =>
    HttpResponse.json({
      project_id: String(params.project),
      start: new Date(Date.now() - 89 * 86_400_000).toISOString().slice(0, 10),
      end: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
      tag_keys: [
        'aws:createdBy',
        'Environment',
        'INFRAWEAVE_ENVIRONMENT',
        'INFRAWEAVE_MODULE_TRACK',
        'INFRAWEAVE_MODULE_VERSION',
        'Name',
        'Owner',
        'application',
        'eks:eks-cluster-name',
        'eks:kubernetes-node-pool-name',
        'team',
      ],
    }),
  ),
  http.get(`${backendBaseUrl}/api/v1/cost_resources/:project/:region`, ({ params, request }) =>
    mockResourceCosts(
      String(params.project),
      String(params.region),
      new URL(request.url).searchParams,
    ),
  ),
  http.get(
    `${backendBaseUrl}/api/v1/cost/:project/:region/:environment/:deploymentId`,
    ({ params, request }) => mockDeploymentCost(params, new URL(request.url).searchParams),
  ),
];

// Made-up but stable: the same deployment and options always return the same numbers.
function mockDeploymentCost(params: Record<string, any>, query: URLSearchParams) {
  const granularity = (query.get('granularity') ?? 'DAILY').toUpperCase();
  const periods = Number(
    query.get('periods') ?? (granularity === 'MONTHLY' ? 6 : granularity === 'HOURLY' ? 24 : 30),
  );
  const groupBy = query.get('group_by') ?? 'SERVICE';
  if (granularity === 'HOURLY' && periods > 14 * 24) {
    return HttpResponse.json(
      {
        error:
          'Cost Explorer rejected the query: Hourly data is only available for the last 14 days',
      },
      { status: 400 },
    );
  }
  const keysByDimension: Record<string, string[]> = {
    SERVICE: [
      'Amazon Elastic Compute Cloud - Compute',
      'Amazon Simple Storage Service',
      'AWS Key Management Service',
      'Amazon CloudWatch',
      'Amazon Virtual Private Cloud',
      'AWS Lambda',
      'Amazon DynamoDB',
    ],
    REGION: [String(params.region), 'global'],
  };
  const keys = keysByDimension[groupBy] ?? ['Usage A', 'Usage B', 'Usage C'];
  // Unblended leaves out Savings Plan coverage, so it comes out lower than amortized.
  const metricScale = query.get('metric') === 'UnblendedCost' ? 0.85 : 1;
  const scale =
    (granularity === 'MONTHLY' ? 30 : granularity === 'HOURLY' ? 1 / 24 : 1) * metricScale;
  const step = granularity === 'MONTHLY' ? 0 : granularity === 'HOURLY' ? 3600_000 : 86_400_000;
  const now = new Date();
  const fmt = (d: Date) =>
    granularity === 'HOURLY'
      ? d.toISOString().replace(/\.\d{3}Z$/, 'Z')
      : d.toISOString().slice(0, 10);
  const periodStart = (i: number) => {
    if (granularity === 'MONTHLY')
      return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (periods - 1 - i), 1));
    const base =
      granularity === 'HOURLY'
        ? Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours())
        : Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    return new Date(base - (periods - 1 - i) * step);
  };
  const totals = new Map<string, number>();
  const result = Array.from({ length: periods }, (_, i) => {
    const start = periodStart(i);
    const end = granularity === 'MONTHLY' ? periodStart(i + 1) : new Date(start.getTime() + step);
    const groups = keys
      .map((k, j) => ({
        keys: [k],
        amount: Number(((6 / (j + 1)) * scale * (1 + 0.3 * Math.sin(i + j))).toFixed(6)),
      }))
      .sort((a, b) => b.amount - a.amount);
    groups.forEach((g) => totals.set(g.keys[0], (totals.get(g.keys[0]) ?? 0) + g.amount));
    return {
      start: fmt(start),
      end: fmt(end),
      estimated: i === periods - 1,
      total: groups.reduce((sum, g) => sum + g.amount, 0),
      groups,
    };
  });
  const groups = [...totals]
    .map(([k, amount]) => ({ keys: [k], amount }))
    .sort((a, b) => b.amount - a.amount);
  return HttpResponse.json({
    project_id: params.project,
    region: params.region,
    environment: decodeURIComponent(String(params.environment)),
    deployment_id: decodeURIComponent(String(params.deploymentId)),
    tag_key: 'INFRAWEAVE_DEPLOYMENT_ID',
    tag_value: decodeURIComponent(String(params.deploymentId)),
    granularity,
    metric: query.get('metric') ?? 'AmortizedCost',
    group_by: groupBy ? [groupBy] : [],
    start: result[0]?.start,
    end: result[result.length - 1]?.end,
    unit: 'USD',
    total: groups.reduce((sum, g) => sum + g.amount, 0),
    groups,
    periods: result,
  });
}

const mockHash = (text: string) => [...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

const MOCK_SERVICES = [
  'Amazon Elastic Compute Cloud - Compute',
  'Amazon Simple Storage Service',
  'AWS Key Management Service',
  'Amazon CloudWatch',
  'Amazon Relational Database Service',
  'AWS Lambda',
];

const listParam = (query: URLSearchParams, name: string) =>
  (query.get(name) ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

function mockPeriods(granularity: string, periods: number) {
  const now = new Date();
  const fmt = (d: Date) =>
    granularity === 'HOURLY'
      ? d.toISOString().replace(/\.\d{3}Z$/, 'Z')
      : d.toISOString().slice(0, 10);
  const startOf = (i: number) => {
    const back = periods - 1 - i;
    if (granularity === 'MONTHLY') {
      return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    }
    if (granularity === 'HOURLY') {
      return new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours()) -
          back * 3600_000,
      );
    }
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - back * 86_400_000,
    );
  };
  return Array.from({ length: periods }, (_, i) => ({
    start: fmt(startOf(i)),
    end: fmt(startOf(i + 1)),
  }));
}

/** Destroyed deployments, which still have cost from while they ran. */
const MOCK_DELETED_DEPLOYMENTS: Record<string, any[]> = {
  '123808927999': [
    {
      project_id: '123808927999',
      region: 'us-west-2',
      environment: 'playground/infraweave_cli',
      deployment_id: 's3bucket/preview-pr42',
      module: 's3bucket',
      status: 'successful',
      deleted: true,
      epoch: Date.now() - 5 * 86_400_000,
    },
  ],
};

/** Deployment ids on resources InfraWeave has no record of, e.g. tags copied by hand. */
const MOCK_UNRECORDED_DEPLOYMENTS: Record<string, string[]> = {
  '123808927998': ['ec2/handmade-instance'],
};

function mockAccountDeployments(project: string) {
  return [
    ...new Map(
      Object.entries(DEPLOYMENTS_BY_PROJECT[project] ?? {}).flatMap(([region, list]) =>
        list.map((d: any) => [String(d.deployment_id), region] as [string, string]),
      ),
    ),
  ]
    .filter(([id]) => mockHash(id) % 4 !== 0)
    .concat(
      (MOCK_DELETED_DEPLOYMENTS[project] ?? []).map((d) => [d.deployment_id, d.region]),
      (MOCK_UNRECORDED_DEPLOYMENTS[project] ?? []).map((id) => [id, 'us-west-2']),
    );
}

/** A stable made-up value of `key` on a deployment's resources; empty for some, as untagged. */
function mockTagValue(key: string, deploymentId: string) {
  if (key === 'INFRAWEAVE_ENVIRONMENT') {
    const known = [
      ...Object.values(DEPLOYMENTS_BY_PROJECT).flatMap((regions) => Object.values(regions).flat()),
      ...Object.values(MOCK_DELETED_DEPLOYMENTS).flat(),
    ].find((d: any) => d.deployment_id === deploymentId);
    return known?.environment ?? '';
  }
  const choice = mockHash(`${key}|${deploymentId}`);
  if (key === 'INFRAWEAVE_MODULE_VERSION') return `0.0.${choice % 4}`;
  if (key === 'INFRAWEAVE_MODULE_TRACK') return ['stable', 'dev', 'beta'][choice % 3];
  if (key === 'INFRAWEAVE_GIT_ACTOR_USERNAME') return ['alice', 'bob', 'carol'][choice % 3];
  return ['platform', 'data', 'payments', ''][choice % 4];
}

function mockAccountCosts(project: string, query: URLSearchParams) {
  const granularity = (query.get('granularity') ?? 'DAILY').toUpperCase();
  const totalsOnly = query.get('series') === 'false';
  const periods = query.get('start')
    ? 1
    : Number(
        query.get('periods') ??
          (granularity === 'MONTHLY' ? 6 : granularity === 'HOURLY' ? 24 : 30),
      );
  const rawGroupBy = query.get('group_by') || null;
  const groupTag = rawGroupBy?.toLowerCase().startsWith('tag:') ? rawGroupBy.slice(4) : null;
  const groupBy = groupTag ? `tag:${groupTag}` : rawGroupBy?.toUpperCase() || null;
  const tagFilters: Record<string, string[]> = JSON.parse(query.get('tag_filters') || '{}');
  const deploymentFilter = listParam(query, 'deployment_ids');
  const moduleFilter = listParam(query, 'modules');
  const serviceFilter = listParam(query, 'services');
  const regionFilter = listParam(query, 'regions');
  // Unblended leaves out Savings Plan coverage, so it comes out lower than amortized.
  const metricScale = query.get('metric') === 'UnblendedCost' ? 0.85 : 1;
  const scale =
    (granularity === 'MONTHLY' ? 30 : granularity === 'HOURLY' ? 1 / 24 : 1) * metricScale;

  const deployments = mockAccountDeployments(project).filter(
    ([id]) =>
      (deploymentFilter.length === 0 || deploymentFilter.includes(id)) &&
      (moduleFilter.length === 0 || moduleFilter.includes(id.split('/')[0])),
  );
  // Each deployment spends on two or three services, in its own region plus a little global.
  const lines = deployments
    .flatMap(([id, region]) =>
      MOCK_SERVICES.filter(
        (_, j) => (mockHash(id) >> j) % 3 === 0 || j === mockHash(id) % 6,
      ).flatMap((service, j) => [
        { id, service, region, base: ((mockHash(id + service) % 900) / 100) * (j === 0 ? 3 : 1) },
        ...(j === 0 ? [{ id, service, region: 'global', base: 0.4 }] : []),
      ]),
    )
    .filter(
      (l) =>
        (serviceFilter.length === 0 || serviceFilter.includes(l.service)) &&
        (regionFilter.length === 0 || regionFilter.includes(l.region)) &&
        Object.entries(tagFilters).every(([key, values]) =>
          values.includes(mockTagValue(key, l.id)),
        ),
    );
  const keyOf = (l: (typeof lines)[number]) =>
    groupTag
      ? mockTagValue(groupTag, l.id)
      : groupBy === 'SERVICE'
        ? l.service
        : groupBy === 'REGION'
          ? l.region
          : groupBy
            ? `${groupBy.toLowerCase()} ${mockHash(l.service) % 3}`
            : '';

  const sum = (entries: [string, number][]) => {
    const totals = new Map<string, number>();
    entries.forEach(([k, v]) => totals.set(k, (totals.get(k) ?? 0) + v));
    return [...totals].sort((a, b) => b[1] - a[1]);
  };
  const periodList = mockPeriods(
    totalsOnly ? 'MONTHLY' : granularity,
    totalsOnly ? 1 : periods,
  ).map((p, i) => {
    const amounts = lines.map((l) => ({
      line: l,
      amount: Number(
        (
          l.base *
          scale *
          (totalsOnly ? periods : 1) *
          (1 + 0.3 * Math.sin(i + mockHash(l.id)))
        ).toFixed(6),
      ),
    }));
    return { ...p, amounts };
  });
  const all = periodList.flatMap((p) => p.amounts);
  const total = all.reduce((t, a) => t + a.amount, 0);

  return HttpResponse.json({
    tag_key: 'INFRAWEAVE_DEPLOYMENT_ID',
    project_id: project,
    granularity: totalsOnly ? 'MONTHLY' : granularity,
    start: periodList[0]?.start,
    end: periodList[periodList.length - 1]?.end,
    metric: query.get('metric') ?? 'AmortizedCost',
    group_by: groupBy,
    unit: 'USD',
    estimated: true,
    total,
    deployments: sum(all.map((a) => [a.line.id, a.amount])).map(([deployment_id, amount]) => ({
      deployment_id,
      amount,
    })),
    ...(groupBy && {
      groups: sum(all.map((a) => [keyOf(a.line), a.amount])).map(([key, amount]) => ({
        key,
        amount,
      })),
      breakdown: sum(all.map((a) => [`${a.line.id}\u0000${keyOf(a.line)}`, a.amount])).map(
        ([k, amount]) => {
          const [deployment_id, key] = k.split('\u0000');
          return { deployment_id, key, amount };
        },
      ),
    }),
    periods: periodList.map((p, i) => ({
      start: p.start,
      end: p.end,
      estimated: i === periodList.length - 1,
      total: p.amounts.reduce((t, a) => t + a.amount, 0),
      deployments: sum(p.amounts.map((a) => [a.line.id, a.amount])).map(
        ([deployment_id, amount]) => ({ deployment_id, amount }),
      ),
      ...(groupBy && {
        groups: sum(p.amounts.map((a) => [keyOf(a.line), a.amount])).map(([key, amount]) => ({
          key,
          amount,
        })),
      }),
    })),
  });
}

function mockResourceCosts(project: string, region: string, query: URLSearchParams) {
  const deploymentFilter = listParam(query, 'deployment_ids');
  if (deploymentFilter.length === 0 && listParam(query, 'services').length === 0) {
    return HttpResponse.json(
      { error: 'Resource costs need deployment_ids or services to narrow them to' },
      { status: 400 },
    );
  }
  const days = Number(query.get('days') ?? 14);
  const resources = mockAccountDeployments(project)
    .filter(([id]) => deploymentFilter.length === 0 || deploymentFilter.includes(id))
    .flatMap(([id, deploymentRegion]) => {
      const name = id.split('/').pop() ?? id;
      return [
        `arn:aws:s3:::${name.replace(/_/g, '-')}`,
        `arn:aws:kms:${deploymentRegion || region}:${project}:key/${mockHash(id).toString(16)}-kms`,
        `arn:aws:logs:${deploymentRegion || region}:${project}:log-group:/infraweave/${name}`,
      ].map((resource_id) => ({
        deployment_id: id,
        resource_id,
        amount: ((mockHash(resource_id) % 4000) / 1000) * days,
      }));
    })
    .sort((a, b) => b.amount - a.amount);
  return HttpResponse.json({
    tag_key: 'INFRAWEAVE_DEPLOYMENT_ID',
    project_id: project,
    start: new Date(Date.now() - (days - 1) * 86_400_000).toISOString().slice(0, 10),
    end: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
    metric: query.get('metric') ?? 'AmortizedCost',
    unit: 'USD',
    estimated: true,
    total: resources.reduce((t, r) => t + r.amount, 0),
    resources,
  });
}
