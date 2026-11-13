import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ConfigProvider } from '../../../contexts/ConfigContext';
import { DenseTable } from './Deployments';
import { Deployment, Project } from '../../../types/Deployment';

// DenseTable is rendered directly rather than through `Deployments`: the filter
// works on the rows it is handed, so a fixture says more about what is matched
// than a mocked fetch of the same rows would.
describe('DenseTable search', () => {
  const base: Deployment = {
    deployment_id: 'placeholder',
    status: 'successful',
    project_id: '123808927999',
    region: 'us-west-2',
    environment: 'dev',
    module: 'ec2',
    drift_detection: { enabled: false, interval: '1h', auto_remediate: false },
    next_drift_check_epoch: -1,
    initiated_by: 'infraweave',
    epoch: 1731268793044,
    job_id: 'job-1',
    module_version: '0.0.15-dev+main.9',
    module_type: 'module',
    module_track: 'dev',
    variables: {},
    dependencies: [],
    dependants: [],
    reference: '',
    error_text: '',
    output: {},
    has_drifted: false,
    policy_results: [],
  };

  const deployment = (overrides: Partial<Deployment>): Deployment => ({ ...base, ...overrides });

  const projects: Project[] = [
    {
      project_id: '123808927999',
      name: 'Dev Account 22',
      description: '',
      regions: ['us-west-2'],
      repositories: [],
    },
    {
      project_id: '123808927997',
      name: 'Prod Account 22',
      description: '',
      regions: ['eu-central-1'],
      repositories: [],
    },
  ];

  const deployments = [
    deployment({ deployment_id: 'ec2_instance_1', module: 'ec2', region: 'eu-central-1' }),
    deployment({
      deployment_id: 's3bucket/my-s3bucket22',
      module: 's3bucket',
      environment: 'playground/infraweave_cli',
    }),
    deployment({
      deployment_id: 'api_gateway_1',
      module: 'bucketcollection',
      environment: 'prod',
      status: 'failed',
      project_id: '123808927997',
    }),
  ];

  const renderTable = (props: Partial<React.ComponentProps<typeof DenseTable>> = {}) =>
    render(
      <MemoryRouter>
        <ConfigProvider backendBaseUrl="http://localhost:7007" isStandalone={false}>
          <DenseTable
            deployments={deployments}
            projects={projects}
            onRefresh={() => {}}
            dialogOpen={() => {}}
            selectedProjectNames={['Dev Account 22']}
            selectedRegions={['us-west-2']}
            isModalOpenRef={{ current: false }}
            {...props}
          />
        </ConfigProvider>
      </MemoryRouter>,
    );

  // The name column renders the last segment of the deployment id, which is what
  // identifies a row on screen.
  const renderedNames = () =>
    screen
      .queryAllByRole('link')
      .map((link) => link.textContent)
      .filter((name): name is string => !!name);

  const search = () => screen.getByLabelText('Search deployments');

  it('filters on a subsequence of the name, not just a substring', async () => {
    renderTable();

    // 'ec2i1' is scattered through "ec2_instance_1" — no substring test finds it.
    await userEvent.type(search(), 'ec2i1');

    expect(renderedNames()).toEqual(['ec2_instance_1']);
    expect(screen.getByText('2 hidden')).toBeInTheDocument();
  });

  it('matches whichever column the user remembers', async () => {
    renderTable();

    // Namespace…
    await userEvent.type(search(), 'playground');
    expect(renderedNames()).toEqual(['my-s3bucket22']);

    // …module…
    await userEvent.clear(search());
    await userEvent.type(search(), 'bucketcollection');
    expect(renderedNames()).toEqual(['api_gateway_1']);

    // …status…
    await userEvent.clear(search());
    await userEvent.type(search(), 'failed');
    expect(renderedNames()).toEqual(['api_gateway_1']);

    // …and region.
    await userEvent.clear(search());
    await userEvent.type(search(), 'eu-central');
    expect(renderedNames()).toEqual(['ec2_instance_1']);
  });

  it('matches a column that is hidden by default', async () => {
    renderTable();

    // The account is only shown once its column is added, but "show me my
    // account's rows" should not require finding that chip first. The name is
    // resolved from the project id, which is all the row itself carries.
    await userEvent.type(search(), 'prod account');

    expect(renderedNames()).toEqual(['api_gateway_1']);
  });

  it('does not let a shared account name answer for every row', async () => {
    renderTable();

    // Two rows are filed under "Dev Account 22", which contains d…v…a…c…c as a
    // subsequence — as it does the letters of almost any short query. Fuzzy
    // matching it therefore made whole accounts match at once and hid nothing, so
    // the columns many rows share are matched literally instead. `prod account`
    // above still finds its row: that one is really in the text.
    await userEvent.type(search(), 'dvacc');

    expect(renderedNames()).toEqual([]);
  });

  it('matches the full deployment id, not only the segment on screen', async () => {
    renderTable();

    // The row reads "my-s3bucket22"; the id behind it is "s3bucket/my-s3bucket22",
    // which is what a shared link or a manifest carries.
    await userEvent.type(search(), 's3bucket/my');

    expect(renderedNames()).toEqual(['my-s3bucket22']);
  });

  it('does not match characters scattered across different columns', async () => {
    renderTable();

    // `prod` is a namespace here and `eu` a region, but never on the same row.
    // Scored against the columns joined into one string, a query can be satisfied
    // by letters picked out of unrelated cells, and the row that comes back looks
    // like a bug. A hit has to be a hit on one thing the user can point at.
    await userEvent.type(search(), 'prodeu');

    expect(renderedNames()).toEqual([]);
    expect(screen.getByText('No matches')).toBeInTheDocument();
  });

  it('says nothing matched, and recovers when cleared', async () => {
    renderTable();

    await userEvent.type(search(), 'zzz');
    expect(renderedNames()).toEqual([]);
    expect(screen.getByText('No matches')).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Clear search'));
    expect(renderedNames()).toHaveLength(3);
  });

  it('keeps the toolbar reachable while nothing matches', async () => {
    renderTable();

    await userEvent.type(search(), 'zzz');

    // Handing the message to the table as empty content replaces the whole card,
    // so a filter that matched nothing would take refresh, the column chips and
    // History with it — and, now that the field lives in that toolbar, the way
    // back out of the query too.
    expect(screen.getByRole('button', { name: /history/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
  });

  it('leaves focus alone unless the page is the deployments list', () => {
    // Embedded as a tab of a module or stack page, this table must not pull focus
    // out of the page it is a section of.
    renderTable();

    expect(search()).not.toHaveFocus();
  });

  it('focuses the field when it is the point of the page', async () => {
    renderTable({ autoFocusSearch: true });

    expect(search()).toHaveFocus();
  });

  it('offers no search box when there are no deployments to filter', () => {
    renderTable({ deployments: [] });

    expect(screen.queryByLabelText('Search deployments')).not.toBeInTheDocument();
  });
});
