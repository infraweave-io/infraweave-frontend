// A localStorage key name, not a credential; gitleaks' generic-api-key rule misreads it.
const STORAGE_KEY = 'infraweave.recentVisits.v1'; // gitleaks:allow

const tokenFor = (sub: string, iss = 'https://idp.example.test') =>
  `header.${btoa(JSON.stringify({ sub, iss })).replace(/=+$/, '')}.signature`;

const signInAs = (sub: string) => localStorage.setItem('auth_token', tokenFor(sub));

/** Re-imports the module with nothing in memory, as a page reload would. */
const reload = async () => {
  vi.resetModules();
  return import('./visitHistory');
};

describe('visitHistory', () => {
  beforeEach(() => {
    localStorage.clear();
    signInAs('alice');
  });

  it('lists pages newest first, moving a revisited page to the top', async () => {
    const { getVisits, recordVisit } = await reload();
    recordVisit('/infraweave/modules', 1);
    recordVisit('/infraweave/module/stable/vpc/1.2.0', 2);
    recordVisit('/infraweave/modules', 3);

    expect(getVisits().map((visit) => [visit.label, visit.at])).toEqual([
      ['Modules', 3],
      ['vpc', 2],
    ]);
  });

  it('treats every tab of a deployment as the same page', async () => {
    const { getVisits, recordVisit } = await reload();
    recordVisit('/infraweave/deployment/111/eu-west-1/dev/s3%2Fbucket/overview', 1);
    recordVisit('/infraweave/deployment/111/eu-west-1/dev/s3%2Fbucket/events', 2);

    expect(getVisits()).toEqual([
      expect.objectContaining({
        kind: 'deployment',
        label: 's3/bucket',
        detail: '111 · eu-west-1 · dev',
        path: '/infraweave/deployment/111/eu-west-1/dev/s3%2Fbucket/events',
      }),
    ]);
  });

  it('leaves out the Overview and unknown routes', async () => {
    const { getVisits, recordVisit } = await reload();
    recordVisit('/infraweave/overview');
    recordVisit('/infraweave/nowhere');
    recordVisit('/login/callback');

    expect(getVisits()).toEqual([]);
  });

  it('keeps visits across a reload for the same user only', async () => {
    (await reload()).recordVisit('/infraweave/modules', 1);

    expect((await reload()).getVisits()).toHaveLength(1);

    signInAs('bob');
    expect((await reload()).getVisits()).toEqual([]);
  });

  it('records nothing when the user is not known', async () => {
    localStorage.removeItem('auth_token');
    const { getVisits, recordVisit } = await reload();
    recordVisit('/infraweave/modules', 1);

    expect(getVisits()).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('drops stored entries that are not visits', async () => {
    const good = {
      key: 'tab/modules',
      path: '/infraweave/modules',
      kind: 'tab',
      label: 'Modules',
      at: 1,
    };
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        owner: 'https://idp.example.test|alice',
        value: [
          good,
          { ...good, key: 'a', kind: 'unknown-kind' },
          { ...good, key: 'b', path: 'https://elsewhere.example.test/' },
          { ...good, key: 'c', at: 'yesterday' },
          null,
        ],
      }),
    );

    expect((await reload()).getVisits()).toEqual([good]);
  });
});
