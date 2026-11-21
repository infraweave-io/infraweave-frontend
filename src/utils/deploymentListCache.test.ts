import { Deployment } from '../types/Deployment';
import {
  clearDeploymentListCache,
  deploymentListScope,
  readCachedDeployments,
  writeCachedDeployments,
} from './deploymentListCache';

/** An id token for `sub`; only its payload is read. */
const tokenFor = (sub: string) =>
  `header.${btoa(JSON.stringify({ sub, iss: 'https://idp.example.test' })).replace(
    /=+$/,
    '',
  )}.signature`;

const signInAs = (sub: string) => localStorage.setItem('auth_token', tokenFor(sub));

/** Re-imports the module with nothing in memory, as a page reload would. */
const reload = async () => {
  vi.resetModules();
  return import('./deploymentListCache');
};

const row = (deployment_id: string): Deployment =>
  ({
    deployment_id,
    variables: { password: 'hunter2' },
    output: { endpoint: 'db.example.test' },
    policy_results: [{ policy: 'p' }],
  }) as unknown as Deployment;

const SCOPE = deploymentListScope(['111'], ['us-west-2']);

describe('deploymentListCache', () => {
  beforeEach(() => {
    localStorage.clear();
    clearDeploymentListCache();
    signInAs('alice');
  });

  it('names a selection the same whatever order it was picked in', () => {
    expect(deploymentListScope(['b', 'a'], ['y', 'x'])).toBe(
      deploymentListScope(['a', 'b'], ['x', 'y']),
    );
    expect(deploymentListScope(['a'], ['x'], 's3bucket')).not.toBe(
      deploymentListScope(['a'], ['x']),
    );
  });

  it('keeps a list across a reload, without inputs, outputs or policy results', async () => {
    writeCachedDeployments(SCOPE, { deployments: [row('a')], fetchedAt: 1 });
    expect(readCachedDeployments(SCOPE)?.deployments[0].variables).toEqual({ password: 'hunter2' });
    expect(localStorage.getItem('infraweave.deployments.v1')).not.toContain('hunter2');

    const fresh = await reload();
    const stored = fresh.readCachedDeployments(SCOPE);
    expect(stored?.deployments.map((d) => d.deployment_id)).toEqual(['a']);
    expect(stored?.deployments[0].variables).toEqual({});
    expect(stored?.deployments[0].output).toEqual({});
    expect(stored?.deployments[0].policy_results).toEqual([]);
  });

  it('does not draw another user’s list from memory after a sign-in in another tab', () => {
    writeCachedDeployments(SCOPE, { deployments: [row('alice')], fetchedAt: 1 });
    // The other tab's clearSession ran there, so this tab's memory was never cleared.
    signInAs('bob');
    expect(readCachedDeployments(SCOPE)).toBeUndefined();

    writeCachedDeployments(SCOPE, { deployments: [row('bob')], fetchedAt: 2 });
    signInAs('alice');
    expect(readCachedDeployments(SCOPE)?.deployments[0].deployment_id).toBe('alice');
  });

  it('never reads back another user’s list', async () => {
    writeCachedDeployments(SCOPE, { deployments: [row('a')], fetchedAt: 1 });
    signInAs('bob');
    const fresh = await reload();
    expect(fresh.readCachedDeployments(SCOPE)).toBeUndefined();
  });

  it('keeps nothing without a known user', () => {
    localStorage.removeItem('auth_token');
    writeCachedDeployments(SCOPE, { deployments: [row('a')], fetchedAt: 1 });
    expect(localStorage.getItem('infraweave.deployments.v1')).toBeNull();
    expect(readCachedDeployments(SCOPE)).toBeUndefined();
  });

  it('keeps only the most recent selections', async () => {
    for (let i = 0; i < 7; i++) {
      writeCachedDeployments(deploymentListScope([String(i)], ['r']), {
        deployments: [row(String(i))],
        fetchedAt: i,
      });
    }
    const fresh = await reload();
    expect(fresh.readCachedDeployments(deploymentListScope(['6'], ['r']))).toBeDefined();
    expect(fresh.readCachedDeployments(deploymentListScope(['2'], ['r']))).toBeDefined();
    expect(fresh.readCachedDeployments(deploymentListScope(['1'], ['r']))).toBeUndefined();
  });

  it('drops older selections when storage is full', async () => {
    writeCachedDeployments(deploymentListScope(['old'], ['r']), {
      deployments: [row('old')],
      fetchedAt: 1,
    });
    const setItem = localStorage.setItem.bind(localStorage);
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === 'infraweave.deployments.v1' && value.includes('"old"')) {
        throw new DOMException('full', 'QuotaExceededError');
      }
      setItem(key, value);
    });
    writeCachedDeployments(SCOPE, { deployments: [row('new')], fetchedAt: 2 });
    spy.mockRestore();

    const fresh = await reload();
    expect(fresh.readCachedDeployments(SCOPE)?.deployments[0].deployment_id).toBe('new');
    expect(fresh.readCachedDeployments(deploymentListScope(['old'], ['r']))).toBeUndefined();
  });

  it('forgets everything on clear', () => {
    writeCachedDeployments(SCOPE, { deployments: [row('a')], fetchedAt: 1 });
    clearDeploymentListCache();
    expect(readCachedDeployments(SCOPE)).toBeUndefined();
    expect(localStorage.getItem('infraweave.deployments.v1')).toBeNull();
  });
});
