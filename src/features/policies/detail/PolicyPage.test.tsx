import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ConfigContext } from '../../../contexts/ConfigContext';
import { ThemeProviderWrapper } from '../../../contexts/ThemeContext';
import { PolicyPage } from './PolicyPage';

/** The API answers a policy lookup with a policy whose description names the URL it was asked for. */
const renderAt = (path: string, goTo: string) => {
  const requested: string[] = [];
  const config = {
    backendBaseUrl: '',
    getString: () => '',
    getApiUrl: (p: string) => `/${p}`,
    fetch: async (input: RequestInfo | URL) => {
      const url = String(input);
      requested.push(url);
      const [environment, policy, version] = url.split('/v1/policy/')[1].split('/');
      return new Response(
        JSON.stringify({
          policy,
          version,
          environment,
          description: `description of ${policy} ${version} in ${environment}`,
          reference: '',
          timestamp: '',
          data: {},
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
      <MemoryRouter initialEntries={[path]}>
        <ConfigContext.Provider value={{ config: config as any, isStandalone: true }}>
          <GoTo />
          <Routes>
            <Route
              path="/infraweave/policy/:environment/:policyName/:policyVersion"
              element={<PolicyPage />}
            />
          </Routes>
        </ConfigContext.Provider>
      </MemoryRouter>
    </ThemeProviderWrapper>,
  );
  return { requested };
};

describe('PolicyPage', () => {
  it('shows the policy the route names', async () => {
    renderAt('/infraweave/policy/prod/no-public-s3/0.4.0', '/infraweave/policy/prod/other/1.0.0');

    expect(
      await screen.findByText('description of no-public-s3 0.4.0 in prod'),
    ).toBeInTheDocument();
  });

  it('shows another policy when a link goes to it from an open policy page', async () => {
    const { requested } = renderAt(
      '/infraweave/policy/prod/no-public-s3/0.4.0',
      '/infraweave/policy/prod/require-tags/2.0.0',
    );
    await screen.findByText('description of no-public-s3 0.4.0 in prod');

    await userEvent.click(screen.getByRole('button', { name: 'go' }));

    expect(
      await screen.findByText('description of require-tags 2.0.0 in prod'),
    ).toBeInTheDocument();
    expect(screen.queryByText('description of no-public-s3 0.4.0 in prod')).not.toBeInTheDocument();
    expect(requested.at(-1)).toContain('/v1/policy/prod/require-tags/2.0.0');
  });

  it('shows another version of the same policy', async () => {
    renderAt(
      '/infraweave/policy/prod/no-public-s3/0.4.0',
      '/infraweave/policy/prod/no-public-s3/0.5.0',
    );
    await screen.findByText('description of no-public-s3 0.4.0 in prod');

    await userEvent.click(screen.getByRole('button', { name: 'go' }));

    expect(
      await screen.findByText('description of no-public-s3 0.5.0 in prod'),
    ).toBeInTheDocument();
  });

  it('shows the same policy in another environment', async () => {
    renderAt(
      '/infraweave/policy/prod/no-public-s3/0.4.0',
      '/infraweave/policy/staging/no-public-s3/0.4.0',
    );
    await screen.findByText('description of no-public-s3 0.4.0 in prod');

    await userEvent.click(screen.getByRole('button', { name: 'go' }));

    expect(
      await screen.findByText('description of no-public-s3 0.4.0 in staging'),
    ).toBeInTheDocument();
  });
});
