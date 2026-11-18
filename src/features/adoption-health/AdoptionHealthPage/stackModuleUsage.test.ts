import { renderHook, waitFor } from '@testing-library/react';
import { Deployment } from '../../../types/Deployment';
import { stacks } from '../../../mocks/stacks';
import { useStackModuleUsage } from './stackModuleUsage';

const hookInputs = vi.hoisted(() => ({ config: undefined as unknown }));

vi.mock('../../../hooks/useConfig', () => ({ useConfig: () => hookInputs.config }));

type StackReply = { body: unknown; status?: number };

const makeConfig = (replies: Record<string, StackReply>) => {
  const paths: string[] = [];
  return {
    paths,
    getApiUrl: (path: string) => `https://example.test/${path}`,
    fetch: (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      paths.push(url.pathname);
      const reply = replies[url.pathname] ?? { body: {}, status: 404 };
      const status = reply.status ?? 200;
      return Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(reply.body),
      } as Response);
    },
  } as unknown as { getApiUrl: (path: string) => string; fetch: typeof fetch; paths: string[] };
};

const deployment = (overrides: Partial<Deployment> = {}): Deployment =>
  ({
    deployment_id: 'deployment-1',
    status: 'succeeded',
    project_id: 'account-1',
    region: 'us-east-1',
    environment: 'dev',
    module: 'app',
    drift_detection: { enabled: false, interval: '', auto_remediate: false },
    next_drift_check_epoch: 0,
    initiated_by: 'test-user',
    epoch: 123,
    job_id: 'job-1',
    module_version: '1.0.0+one',
    module_type: 'stack',
    module_track: 'prod',
    variables: {},
    dependencies: [],
    dependants: [],
    reference: '',
    error_text: '',
    output: {},
    has_drifted: false,
    policy_results: [],
    ...overrides,
  }) as Deployment;

describe('useStackModuleUsage', () => {
  it('expands exact stack versions per deployment and preserves repeated components', async () => {
    const bucketCollection = stacks[0];
    const websiteRunner = stacks[1];
    const config = makeConfig({
      [`/api/proxy/api/infraweave/api/v1/stack/${bucketCollection.track}/${
        bucketCollection.module
      }/${encodeURIComponent(bucketCollection.version)}`]: { body: bucketCollection },
      [`/api/proxy/api/infraweave/api/v1/stack/${websiteRunner.track}/${
        websiteRunner.module
      }/${encodeURIComponent(websiteRunner.version)}`]: { body: websiteRunner },
    });
    hookInputs.config = config;
    const parents = [
      deployment({
        module: bucketCollection.module,
        module_track: bucketCollection.track,
        module_version: bucketCollection.version,
      }),
      deployment({
        deployment_id: 'deployment-2',
        project_id: 'account-2',
        region: 'eu-west-1',
        environment: 'prod',
        module: bucketCollection.module,
        module_track: bucketCollection.track,
        module_version: bucketCollection.version,
      }),
      deployment({
        deployment_id: 'deployment-3',
        module: websiteRunner.module,
        module_track: websiteRunner.track,
        module_version: websiteRunner.version,
      }),
    ];

    const { result } = renderHook(() => useStackModuleUsage(parents));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(config.paths).toEqual([
      `/api/proxy/api/infraweave/api/v1/stack/dev/bucketcollection/${encodeURIComponent(
        bucketCollection.version,
      )}`,
      `/api/proxy/api/infraweave/api/v1/stack/dev/websiterunner/${encodeURIComponent(
        websiteRunner.version,
      )}`,
    ]);
    expect(result.current.incomplete).toBe(false);
    expect(result.current.uses).toHaveLength(7);
    expect(result.current.uses.slice(0, 2)).toMatchObject([
      {
        module: 's3bucket',
        module_version: '0.0.36-dev+test.6',
        module_track: '',
        componentIndex: 0,
      },
      {
        module: 's3bucket',
        module_version: '0.0.36-dev+test.6',
        module_track: '',
        componentIndex: 1,
      },
    ]);
    expect(result.current.uses[0]).toMatchObject({
      deployment_id: 'deployment-1',
      project_id: 'account-1',
      region: 'us-east-1',
      environment: 'dev',
      status: 'succeeded',
      epoch: 123,
      module_type: 'module',
      usageSource: 'stack',
      stackName: 'bucketcollection',
      stackVersion: bucketCollection.version,
    });
    expect(result.current.uses[2]).toMatchObject({
      deployment_id: 'deployment-2',
      project_id: 'account-2',
      region: 'eu-west-1',
      environment: 'prod',
      module: 's3bucket',
    });
    expect(result.current.uses[4]).toMatchObject({
      module: 'ec2',
      module_version: '0.0.5-dev+main.1',
      module_track: '',
      deployment_id: 'deployment-3',
      componentIndex: 0,
    });
  });

  it('reports missing parent keys, failed lookups, and missing compositions as incomplete', async () => {
    const config = makeConfig({
      '/api/proxy/api/infraweave/api/v1/stack/prod/unreachable/1.0.0': {
        body: {},
        status: 503,
      },
      '/api/proxy/api/infraweave/api/v1/stack/prod/no-composition/1.0.0': {
        body: { module: 'no-composition' },
      },
    });
    hookInputs.config = config;
    const parents = [
      deployment({ module: 'unreachable', module_version: '1.0.0' }),
      deployment({ module: 'no-composition', module_version: '1.0.0' }),
      deployment({ module_track: '' }),
    ];

    const { result } = renderHook(() => useStackModuleUsage(parents));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.uses).toEqual([]);
    expect(result.current.incomplete).toBe(true);
    expect(config.paths).toEqual([
      '/api/proxy/api/infraweave/api/v1/stack/prod/unreachable/1.0.0',
      '/api/proxy/api/infraweave/api/v1/stack/prod/no-composition/1.0.0',
    ]);
  });

  it('reports null components as incomplete and keeps the valid ones', async () => {
    hookInputs.config = makeConfig({
      '/api/proxy/api/infraweave/api/v1/stack/prod/app/1.0.0': {
        body: { stack_data: { modules: [null, { module: 's3bucket', version: '1.2.3' }] } },
      },
    });
    const parents = [deployment({ module_version: '1.0.0' })];

    const { result } = renderHook(() => useStackModuleUsage(parents));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.incomplete).toBe(true);
    expect(result.current.uses).toHaveLength(1);
    expect(result.current.uses[0]).toMatchObject({
      module: 's3bucket',
      module_version: '1.2.3',
      componentIndex: 1,
    });
  });

  it('reuses loaded compositions on remount and retries failed ones', async () => {
    const config = makeConfig({
      '/api/proxy/api/infraweave/api/v1/stack/prod/app/1.0.0': {
        body: { stack_data: { modules: [{ module: 's3bucket', version: '1.2.3' }] } },
      },
      '/api/proxy/api/infraweave/api/v1/stack/prod/unreachable/1.0.0': {
        body: {},
        status: 503,
      },
    });
    hookInputs.config = config;
    const parents = [
      deployment({ module_version: '1.0.0' }),
      deployment({ module: 'unreachable', module_version: '1.0.0' }),
    ];

    const first = renderHook(() => useStackModuleUsage(parents));
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    first.unmount();
    const second = renderHook(() => useStackModuleUsage([...parents]));
    await waitFor(() => expect(second.result.current.loading).toBe(false));

    expect(second.result.current.uses).toHaveLength(1);
    expect(second.result.current.incomplete).toBe(true);
    expect(config.paths).toEqual([
      '/api/proxy/api/infraweave/api/v1/stack/prod/app/1.0.0',
      '/api/proxy/api/infraweave/api/v1/stack/prod/unreachable/1.0.0',
      '/api/proxy/api/infraweave/api/v1/stack/prod/unreachable/1.0.0',
    ]);
  });
});
