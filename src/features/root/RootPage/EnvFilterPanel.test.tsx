import React from 'react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ConfigProvider } from '../../../contexts/ConfigContext';
import { SelectedProjectsProvider } from './SelectedProjectsContext';
import EnvFilterPanel from './EnvFilterPanel';
import { projects } from '../../../mocks/projects';
import { clearProjectCache } from '../../../utils/projectCache';

describe('EnvFilterPanel', () => {
  const backendBaseUrl = 'http://localhost:7007';
  const server = setupServer();
  const projectsUrl = `${backendBaseUrl}/api/proxy/api/infraweave/api/v1/projects`;

  beforeAll(() => server.listen());
  afterAll(() => server.close());

  let requestCount = 0;

  beforeEach(() => {
    // Both the cache and the persisted selections outlive a test by design, and
    // the project list is also held in memory for the whole page load — which one
    // test file is, so that copy has to be dropped between tests too.
    localStorage.clear();
    clearProjectCache();
    requestCount = 0;
    server.use(
      http.get(projectsUrl, () => {
        requestCount++;
        return HttpResponse.json(projects);
      }),
    );
  });

  afterEach(() => {
    server.resetHandlers();
    // Some tests move the clock on to age the cache.
    vi.restoreAllMocks();
  });

  const renderPanel = () =>
    render(
      <MemoryRouter>
        <ConfigProvider backendBaseUrl={backendBaseUrl} isStandalone={false}>
          <SelectedProjectsProvider>
            <EnvFilterPanel />
          </SelectedProjectsProvider>
        </ConfigProvider>
      </MemoryRouter>,
    );

  const CACHE_KEY = 'infraweave.projects.v1';

  it('caches the fetched projects', async () => {
    renderPanel();
    expect(await screen.findByLabelText('Dev Account 22')).toBeInTheDocument();

    const cached = JSON.parse(localStorage.getItem(CACHE_KEY)!);
    expect(cached.projects.map((p: { name: string }) => p.name)).toEqual([
      'Dev Account 22',
      'Staging Account 22',
      'Prod Account 22',
    ]);
    expect(cached.fetchedAt).toBeGreaterThan(0);
  });

  it('issues one request for two providers mounted at once', async () => {
    // ResourceTabs mounts SelectedProjectsProvider twice, and the deploy dialog
    // adds a third project consumer, so a cold start used to fire a request per
    // mount.
    render(
      <MemoryRouter>
        <ConfigProvider backendBaseUrl={backendBaseUrl} isStandalone={false}>
          <SelectedProjectsProvider>
            <EnvFilterPanel />
          </SelectedProjectsProvider>
          <SelectedProjectsProvider>
            <EnvFilterPanel />
          </SelectedProjectsProvider>
        </ConfigProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getAllByLabelText('Dev Account 22').length).toBe(2));
    expect(requestCount).toBe(1);
  });

  it('draws cached projects with no request while the cache is fresh', async () => {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ fetchedAt: Date.now(), projects: projects.slice(0, 1) }),
    );

    renderPanel();

    // Present on the first paint, before any request could have resolved.
    expect(screen.getByLabelText('Dev Account 22')).toBeInTheDocument();
    // Give a stray fetch time to land before asserting none happened.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(requestCount).toBe(0);
  });

  it('refetches a stale cache and silently swaps in an added project', async () => {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        fetchedAt: Date.now() - 61000,
        projects: projects.slice(0, 1),
      }),
    );

    renderPanel();

    // The stale list shows immediately — no spinner, no blank panel.
    expect(screen.getByLabelText('Dev Account 22')).toBeInTheDocument();
    // ...and the two projects the cache didn't know about appear on their own.
    expect(await screen.findByLabelText('Prod Account 22')).toBeInTheDocument();
    expect(requestCount).toBe(1);
  });

  it('drops a project the API no longer returns', async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now() - 61000, projects }));
    server.use(
      http.get(projectsUrl, () => {
        requestCount++;
        return HttpResponse.json(projects.slice(0, 1));
      }),
    );

    renderPanel();

    expect(screen.getByLabelText('Prod Account 22')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByLabelText('Prod Account 22')).not.toBeInTheDocument());
    expect(screen.getByLabelText('Dev Account 22')).toBeInTheDocument();
  });

  it('keeps showing cached projects when the refresh fails', async () => {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ fetchedAt: Date.now() - 61000, projects: projects.slice(0, 1) }),
    );
    server.use(
      http.get(projectsUrl, () => {
        requestCount++;
        return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
      }),
    );

    renderPanel();

    await waitFor(() => expect(requestCount).toBe(1));
    // An error panel here would replace a perfectly usable filter list.
    expect(screen.getByLabelText('Dev Account 22')).toBeInTheDocument();
  });

  it('refreshes a stale list when the tab is returned to', async () => {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ fetchedAt: Date.now(), projects: projects.slice(0, 1) }),
    );

    renderPanel();
    expect(screen.getByLabelText('Dev Account 22')).toBeInTheDocument();
    expect(requestCount).toBe(0);

    // The providers that own the list sit above the router, so they mount once per
    // page load: without this, a tab left open all day would never see a project
    // that was added after it loaded.
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + 61000);
    window.dispatchEvent(new Event('focus'));

    expect(await screen.findByLabelText('Prod Account 22')).toBeInTheDocument();
    expect(requestCount).toBe(1);
  });

  it('updates a panel that mounted before another one refreshed the list', async () => {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ fetchedAt: Date.now(), projects: projects.slice(0, 1) }),
    );

    // Mounts while the cache is fresh, so this panel never fetches anything itself.
    renderPanel();
    expect(screen.getAllByLabelText('Dev Account 22')).toHaveLength(1);

    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + 61000);
    // A second consumer mounts later — the deploy dialog, say — and by then the
    // list has gone stale, so this one does fetch.
    renderPanel();

    await waitFor(() => expect(requestCount).toBe(1));
    // Both panels show the fetched list: one fetch, one list, every consumer.
    await waitFor(() => expect(screen.getAllByLabelText('Prod Account 22')).toHaveLength(2));
  });

  it('refetches when nothing in the cache validates', async () => {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ fetchedAt: Date.now(), projects: [{ name: 'Legacy Account' }] }),
    );

    renderPanel();

    // The timestamp is recent, but a record with no regions is unusable, so the
    // cache is empty in practice — reporting it as fresh would leave the panel
    // blank with no request, no spinner and no error.
    expect(await screen.findByLabelText('Dev Account 22')).toBeInTheDocument();
    expect(requestCount).toBe(1);
    expect(screen.queryByLabelText('Legacy Account')).not.toBeInTheDocument();
  });

  it('drops a fetched record that is missing an array consumers read through', async () => {
    server.use(
      http.get(projectsUrl, () => {
        requestCount++;
        // `repositories: undefined` is dropped by the JSON encoding, so this is
        // the same record the API would send with the field omitted.
        return HttpResponse.json([projects[0], { ...projects[1], repositories: undefined }]);
      }),
    );

    renderPanel();

    // `DeploySelectedContext` flat-maps `repositories` and then reads `type` off
    // each element, so a record without it throws there and takes out the deploy
    // dialog. Storing it is what would make that crash outlive the response.
    expect(await screen.findByLabelText('Dev Account 22')).toBeInTheDocument();
    expect(screen.queryByLabelText('Staging Account 22')).not.toBeInTheDocument();
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY)!);
    expect(cached.projects.map((p: { name: string }) => p.name)).toEqual(['Dev Account 22']);
  });

  it('does not trust the age of a list it had to filter', async () => {
    server.use(
      http.get(projectsUrl, () => {
        requestCount++;
        return HttpResponse.json([projects[0], { name: 'Half a project' }]);
      }),
    );

    renderPanel();
    expect(await screen.findByLabelText('Dev Account 22')).toBeInTheDocument();
    await waitFor(() => expect(requestCount).toBe(1));

    // What was stored is short of what the API returned, so its age says nothing
    // about the list: stamping it fresh would stand on an incomplete panel for the
    // whole window — with nothing surviving validation, on an empty one, with no
    // spinner, no error, and no request to recover with.
    expect(JSON.parse(localStorage.getItem(CACHE_KEY)!).fetchedAt).toBe(0);

    renderPanel();
    await waitFor(() => expect(requestCount).toBe(2));
  });

  describe('project search and ordering', () => {
    /** Names of the project checkboxes, in the order they are rendered. */
    const renderedProjects = () =>
      screen
        // queryAll, not getAll: an empty result is a valid outcome here.
        .queryAllByRole('checkbox')
        .map((box) => box.getAttribute('name'))
        .filter((name) => name?.endsWith('Account 22'));

    const seedFreshCache = () =>
      localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), projects }));

    it('lists projects alphabetically rather than in API order', () => {
      // The API returns Dev, Staging, Prod — the order rows land in database.
      seedFreshCache();
      renderPanel();

      expect(renderedProjects()).toEqual([
        'Dev Account 22',
        'Prod Account 22',
        'Staging Account 22',
      ]);
    });

    it('moves the projects selected on arrival to the top, alphabetically', () => {
      seedFreshCache();
      localStorage.setItem(
        'selectedProjectNames',
        JSON.stringify(['Staging Account 22', 'Prod Account 22']),
      );

      renderPanel();

      // Both selected, so both rise above Dev and sort against each other.
      expect(renderedProjects()).toEqual([
        'Prod Account 22',
        'Staging Account 22',
        'Dev Account 22',
      ]);
    });

    it('does not reorder the list under the cursor as boxes are ticked', async () => {
      seedFreshCache();
      renderPanel();

      await userEvent.click(screen.getByLabelText('Staging Account 22'));
      await userEvent.click(screen.getByLabelText('Prod Account 22'));

      // Pinning on the live selection moved every remaining row between these two
      // clicks, so the second one landed on whatever had slid into its place.
      expect(renderedProjects()).toEqual([
        'Dev Account 22',
        'Prod Account 22',
        'Staging Account 22',
      ]);
      expect(screen.getByLabelText('Staging Account 22')).toBeChecked();
      expect(screen.getByLabelText('Prod Account 22')).toBeChecked();

      // The next search is when reordering is safe again — nothing is under the
      // cursor by then.
      await userEvent.type(screen.getByLabelText('Search projects'), 'a');
      await userEvent.click(screen.getByLabelText('Clear search'));
      expect(renderedProjects()).toEqual([
        'Prod Account 22',
        'Staging Account 22',
        'Dev Account 22',
      ]);
    });

    it('filters on a subsequence, not just a substring', async () => {
      seedFreshCache();
      renderPanel();

      // 'sgacc' appears in "Staging Account 22" only as scattered characters.
      await userEvent.type(screen.getByLabelText('Search projects'), 'sgacc');

      expect(renderedProjects()).toEqual(['Staging Account 22']);
      expect(screen.getByText('2 hidden by search')).toBeInTheDocument();
    });

    it('narrows on every keystroke, with no Enter press', async () => {
      seedFreshCache();
      renderPanel();
      const search = screen.getByLabelText('Search projects');

      // Asserting between keystrokes, so nothing here can be satisfied by a
      // filter that only applies on submit. 'd' hits Dev and Prod (Dev first: it
      // matches at position 0), and 'e' then drops Prod.
      await userEvent.type(search, 'd');
      expect(renderedProjects()).toEqual(['Dev Account 22', 'Prod Account 22']);

      await userEvent.type(search, 'e');
      expect(renderedProjects()).toEqual(['Dev Account 22']);

      // Backspace has to widen it again, not just stop narrowing.
      await userEvent.type(search, '{backspace}');
      expect(renderedProjects()).toEqual(['Dev Account 22', 'Prod Account 22']);

      // And Enter changes nothing — there is no submit step to wait for.
      await userEvent.type(search, '{enter}');
      expect(renderedProjects()).toEqual(['Dev Account 22', 'Prod Account 22']);
    });

    it('keeps a selected project visible, below the matches, when it does not match', async () => {
      seedFreshCache();
      renderPanel();

      await userEvent.click(screen.getByLabelText('Dev Account 22'));
      await userEvent.type(screen.getByLabelText('Search projects'), 'prod');

      // Hiding it would strand a filter the user cannot see or switch off — but it
      // is not a search result either, so it sits under the matches, labelled,
      // rather than pushing them down.
      expect(renderedProjects()).toEqual(['Prod Account 22', 'Dev Account 22']);
      expect(screen.getByText('Selected, not matching')).toBeInTheDocument();
    });

    it('says the list is empty rather than blaming a search nobody typed', async () => {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), projects: [] }));

      renderPanel();

      // A tenant with no projects, or a cold cache, used to be told that nothing
      // matched “”.
      expect(await screen.findByText('No projects available.')).toBeInTheDocument();
    });

    it('says so when nothing matches, and recovers when cleared', async () => {
      seedFreshCache();
      renderPanel();

      await userEvent.type(screen.getByLabelText('Search projects'), 'zzz');
      expect(renderedProjects()).toEqual([]);
      expect(screen.getByText('No projects match “zzz”.')).toBeInTheDocument();

      await userEvent.click(screen.getByLabelText('Clear search'));
      expect(renderedProjects()).toHaveLength(3);
    });
  });

  it('offers the regions of a selected project, from cache alone', async () => {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ fetchedAt: Date.now(), projects: projects.slice(0, 1) }),
    );

    renderPanel();
    await userEvent.click(screen.getByLabelText('Dev Account 22'));

    // Regions are read off the project records, so a cached project brings its
    // regions with it.
    expect(await screen.findByLabelText('eu-central-1')).toBeInTheDocument();
    expect(screen.getByLabelText('us-west-2')).toBeInTheDocument();
    expect(requestCount).toBe(0);
  });

  it('offers every project’s regions until a project is selected', async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), projects }));

    renderPanel();

    // The region filter sits above the projects, so it is offered before any
    // project is ticked — once each, though every project shares two of them.
    const regionBoxes = () =>
      screen
        .getAllByRole('checkbox')
        .map((box) => box.getAttribute('name'))
        .filter((name) => !name?.endsWith('Account 22'));
    await waitFor(() => expect(regionBoxes()).toEqual(['eu-central-1', 'us-west-2', 'us-east-1']));

    // Only Dev has us-east-1, so selecting Staging narrows the list to its own.
    await userEvent.click(screen.getByLabelText('Staging Account 22'));
    expect(regionBoxes()).toEqual(['eu-central-1', 'us-west-2']);
  });
});
