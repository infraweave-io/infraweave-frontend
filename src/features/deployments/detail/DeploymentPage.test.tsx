import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { DeploymentPage } from './DeploymentPage';

vi.mock('../../../hooks/useDeployment', () => ({
  useDeployment: () => ({
    value: { deployment_id: 'payments-api', environment: 'prod', status: 'deployed' },
    loading: false,
    error: undefined,
    refetch: () => {},
  }),
}));
vi.mock('./DeploymentOverview', () => ({
  DeploymentOverview: () => <div>overview content</div>,
}));
vi.mock('./Events', () => ({ AllChangeRecords: () => <div>events content</div> }));
vi.mock('./jobDrawer', () => ({ JobDrawer: () => null }));

const base = '/infraweave/deployment/123456789012/eu-central-1/prod/payments-api';

const GoTo = ({ to }: { to: string }) => {
  const navigate = useNavigate();
  return <button onClick={() => navigate(to)}>{`go to ${to}`}</button>;
};

const renderAt = (path: string, goTo: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <GoTo to={goTo} />
      <Routes>
        <Route
          path="/infraweave/deployment/:project/:region/:environment/:deploymentId/:tab"
          element={<DeploymentPage />}
        />
        <Route
          path="/infraweave/deployment/:project/:region/:environment/:deploymentId"
          element={<DeploymentPage />}
        />
      </Routes>
    </MemoryRouter>,
  );

describe('DeploymentPage', () => {
  it('opens the overview when the route has no tab', () => {
    renderAt(base, `${base}/events`);

    expect(screen.getByText('overview content')).toBeInTheDocument();
    expect(screen.queryByText('events content')).not.toBeInTheDocument();
  });

  it('opens the tab the route names', () => {
    renderAt(`${base}/events`, `${base}/overview`);

    expect(screen.getByText('events content')).toBeInTheDocument();
    expect(screen.queryByText('overview content')).not.toBeInTheDocument();
  });

  it('follows a link from the overview to the events tab', async () => {
    renderAt(`${base}/overview`, `${base}/events`);

    await userEvent.click(screen.getByRole('button', { name: `go to ${base}/events` }));

    expect(screen.getByText('events content')).toBeInTheDocument();
    expect(screen.queryByText('overview content')).not.toBeInTheDocument();
  });

  it('follows a link from the events tab back to the overview', async () => {
    renderAt(`${base}/events`, base);

    await userEvent.click(screen.getByRole('button', { name: `go to ${base}` }));

    expect(screen.getByText('overview content')).toBeInTheDocument();
    expect(screen.queryByText('events content')).not.toBeInTheDocument();
  });
});
