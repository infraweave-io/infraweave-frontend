import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ConfigContext } from '../../contexts/ConfigContext';
import { ResourcePage } from './ResourcePage';

const record = (module_type: string) => ({
  module: 's3bucket',
  module_name: 's3bucket',
  module_type,
  track: 'alpha',
  version: '0.0.98-alpha',
});

/** Mounts both detail routes at `path`, with the API answering every lookup with `body`. */
const renderAt = (path: string, body: unknown) => {
  const requested: string[] = [];
  const config = {
    backendBaseUrl: '',
    getString: () => '',
    getApiUrl: (p: string) => `/${p}`,
    fetch: async (input: RequestInfo | URL) => {
      requested.push(String(input));
      return new Response(JSON.stringify(body), { status: 200 });
    },
  };
  const page = (resourceType: 'module' | 'stack') => (
    <ResourcePage
      resourceType={resourceType}
      renderTabContent={(value) => <div>{`${resourceType} page for ${value?.module}`}</div>}
    />
  );
  render(
    <MemoryRouter initialEntries={[path]}>
      <ConfigContext.Provider value={{ config: config as any, isStandalone: true }}>
        <Routes>
          <Route
            path="/infraweave/module/:track/:moduleName/:moduleVersion"
            element={page('module')}
          />
          <Route path="/infraweave/stack/:track/:stackName/:stackVersion" element={page('stack')} />
        </Routes>
      </ConfigContext.Provider>
    </MemoryRouter>,
  );
  return { requested };
};

describe('ResourcePage', () => {
  it('redirects a stack opened under the module route to the stack route', async () => {
    const { requested } = renderAt(
      '/infraweave/module/alpha/s3bucket/0.0.98-alpha',
      record('stack'),
    );

    expect(await screen.findByText('stack page for s3bucket')).toBeInTheDocument();
    expect(screen.queryByText('module page for s3bucket')).not.toBeInTheDocument();
    expect(requested.at(-1)).toBe(
      '/api/proxy/api/infraweave/api/v1/stack/alpha/s3bucket/0.0.98-alpha',
    );
  });

  it('redirects a module opened under the stack route to the module route', async () => {
    renderAt('/infraweave/stack/alpha/s3bucket/0.0.98-alpha', record('module'));

    expect(await screen.findByText('module page for s3bucket')).toBeInTheDocument();
    expect(screen.queryByText('stack page for s3bucket')).not.toBeInTheDocument();
  });

  it('renders the page when the record matches the route', async () => {
    const { requested } = renderAt(
      '/infraweave/stack/alpha/s3bucket/0.0.98-alpha',
      record('stack'),
    );

    expect(await screen.findByText('stack page for s3bucket')).toBeInTheDocument();
    expect(requested).toHaveLength(1);
  });
});
