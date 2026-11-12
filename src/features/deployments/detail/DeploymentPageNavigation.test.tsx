import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ConfigContext } from '../../../contexts/ConfigContext';
import { ThemeProviderWrapper } from '../../../contexts/ThemeContext';
import { DeploymentPage } from './DeploymentPage';

// The real useDeployment hook runs here; only the heavy children are replaced.
vi.mock('./DeploymentOverview', () => ({
  DeploymentOverview: ({ deployment }: { deployment?: { deployment_id: string } }) => (
    <div>{`overview of ${deployment?.deployment_id}`}</div>
  ),
}));
vi.mock('./Events', () => ({ AllChangeRecords: () => null }));
vi.mock('./jobDrawer', () => ({ JobDrawer: () => null }));

const path = (id: string) => `/infraweave/deployment/123456789012/eu-central-1/prod/${id}`;

const renderAt = (start: string, goTo: string, failFor: string) => {
  const config = {
    backendBaseUrl: '',
    getString: () => '',
    getApiUrl: (p: string) => `/${p}`,
    fetch: async (input: RequestInfo | URL) => {
      const id = String(input).split('/').pop()?.split('?')[0] ?? '';
      if (id === failFor) throw new Error(`could not load ${id}`);
      return new Response(
        JSON.stringify({
          deployment_id: id,
          environment: 'prod',
          project_id: '123456789012',
          region: 'eu-central-1',
          status: 'deployed',
          epoch: 1,
        }),
        { status: 200 },
      );
    },
  };
  const GoTo = () => {
    const navigate = useNavigate();
    return <button onClick={() => navigate(goTo)}>go</button>;
  };
  render(
    <ThemeProviderWrapper>
      <MemoryRouter initialEntries={[start]}>
        <ConfigContext.Provider value={{ config: config as any, isStandalone: true }}>
          <GoTo />
          <Routes>
            <Route
              path="/infraweave/deployment/:project/:region/:environment/:deploymentId"
              element={<DeploymentPage />}
            />
          </Routes>
        </ConfigContext.Provider>
      </MemoryRouter>
    </ThemeProviderWrapper>,
  );
};

describe('DeploymentPage navigation', () => {
  it('shows another deployment when a link goes to it', async () => {
    renderAt(path('deployment-a'), path('deployment-b'), 'none');
    expect(await screen.findByText('overview of deployment-a')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'go' }));

    expect(await screen.findByText('overview of deployment-b')).toBeInTheDocument();
    expect(screen.queryByText('overview of deployment-a')).not.toBeInTheDocument();
  });

  it('reports a failed load of the other deployment instead of keeping the previous one', async () => {
    renderAt(path('deployment-a'), path('deployment-b'), 'deployment-b');
    expect(await screen.findByText('overview of deployment-a')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'go' }));

    expect(await screen.findByText(/could not load deployment-b/)).toBeInTheDocument();
    expect(screen.queryByText('overview of deployment-a')).not.toBeInTheDocument();
  });
});
