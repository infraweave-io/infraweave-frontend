import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ConfigContext } from '../../contexts/ConfigContext';
import { ThemeProviderWrapper } from '../../contexts/ThemeContext';
import { ResourceDetailPage } from './ResourceDetailPage';

vi.mock('./ZipBrowser', () => ({ ZipBrowser: () => null }));
vi.mock('./DeployResourceDialog', () => ({ DeployResourceDialog: () => null }));
vi.mock('../../features/modules/detail/CompareVersionsDialog', () => ({
  CompareVersionsDialog: () => null,
}));

const moduleRecord = (name: string, examples: string[]) => ({
  module: name,
  module_name: name,
  module_type: 'module',
  track: 'stable',
  version: '1.0.0',
  s3_key: 'modules/key.zip',
  manifest: {
    metadata: { name },
    spec: {
      moduleName: name,
      version: '1.0.0',
      description: `description of ${name}`,
      examples: examples.map((example) => ({ name: example, variables: {} })),
    },
  },
  tf_variables: [],
  tf_outputs: [],
});

const records: Record<string, ReturnType<typeof moduleRecord>> = {
  threeexamples: moduleRecord('threeexamples', ['ex-a1', 'ex-a2', 'ex-a3']),
  twoexamples: moduleRecord('twoexamples', ['ex-b1', 'ex-b2']),
};

const GoTo = ({ to }: { to: string }) => {
  const navigate = useNavigate();
  return <button onClick={() => navigate(to)}>{`go to ${to}`}</button>;
};

const renderAt = (path: string, goTo: string) => {
  const config = {
    backendBaseUrl: '',
    getString: () => '',
    getApiUrl: (p: string) => `/${p}`,
    fetch: async (input: RequestInfo | URL) => {
      const match = String(input).match(/\/v1\/module\/[^/]+\/([^/]+)\/[^/]+$/);
      const record = match && records[match[1]];
      return new Response(JSON.stringify(record || []), { status: 200 });
    },
  };
  render(
    <ThemeProviderWrapper>
      <MemoryRouter initialEntries={[path]}>
        <ConfigContext.Provider value={{ config: config as any, isStandalone: true }}>
          <GoTo to={goTo} />
          <Routes>
            <Route
              path="/infraweave/module/:track/:moduleName/:moduleVersion"
              element={<ResourceDetailPage resourceType="module" />}
            />
          </Routes>
        </ConfigContext.Provider>
      </MemoryRouter>
    </ThemeProviderWrapper>,
  );
};

describe('ResourceDetailPage', () => {
  it('shows the example the user picked', async () => {
    renderAt('/infraweave/module/stable/threeexamples/1.0.0', '/infraweave/module/stable/x/1.0.0');

    await userEvent.click(await screen.findByRole('button', { name: /Show Example Claim/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'ex-a3' }));

    expect(screen.getByText(/Example Module Claim Format \(ex-a3\)/)).toBeInTheDocument();
  });

  it('starts from the first example when a link goes to another module with fewer examples', async () => {
    const target = '/infraweave/module/stable/twoexamples/1.0.0';
    renderAt('/infraweave/module/stable/threeexamples/1.0.0', target);
    await userEvent.click(await screen.findByRole('button', { name: /Show Example Claim/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'ex-a3' }));

    await userEvent.click(screen.getByRole('button', { name: `go to ${target}` }));

    // The other module is a fresh page: the claim is collapsed again, with the first example.
    await userEvent.click(await screen.findByRole('button', { name: /Show Example Claim/ }));
    expect(await screen.findByRole('button', { name: 'ex-b2' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ex-a3' })).not.toBeInTheDocument();
    expect(screen.getByText(/Example Module Claim Format \(ex-b1\)/)).toBeInTheDocument();
  });
});
