import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConfigContext } from '../../../contexts/ConfigContext';
import { ModuleVersions } from './ModuleVersions';

const version = (v: string) => ({
  module: 's3bucket',
  module_name: 'S3Bucket',
  track: 'alpha',
  version: v,
  timestamp: '2026-10-01T00:00:00Z',
});

const singlePage = async () =>
  new Response(JSON.stringify([version('0.0.98-alpha')]), { status: 200 });

const renderVersions = (
  resourceType: 'module' | 'stack',
  fetch: (url: string) => Promise<Response> = singlePage,
) => {
  const config = {
    backendBaseUrl: '',
    getString: () => '',
    getApiUrl: (path: string) => `/${path}`,
    fetch,
  };
  render(
    <MemoryRouter>
      <ConfigContext.Provider value={{ config: config as any, isStandalone: true }}>
        <ModuleVersions module="s3bucket" track="alpha" resourceType={resourceType} hideChanges />
      </ConfigContext.Provider>
    </MemoryRouter>,
  );
};

describe('ModuleVersions', () => {
  it.each(['module', 'stack'] as const)(
    'links %s versions to the %s route',
    async (resourceType) => {
      renderVersions(resourceType);

      const link = await screen.findByRole('link', { name: '0.0.98-alpha' });
      expect(link).toHaveAttribute(
        'href',
        `/infraweave/${resourceType}/alpha/s3bucket/0.0.98-alpha`,
      );
    },
  );

  it('follows next_token past the first page of versions', async () => {
    const requested: string[] = [];
    renderVersions('stack', async (url) => {
      requested.push(url);
      const second = url.includes('next_token=page-2');
      return new Response(JSON.stringify([version(second ? '0.0.97-alpha' : '0.0.98-alpha')]), {
        status: 200,
        headers: second ? {} : { 'x-next-token': 'page-2' },
      });
    });

    expect(await screen.findByRole('link', { name: '0.0.97-alpha' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '0.0.98-alpha' })).toBeInTheDocument();
    expect(requested).toHaveLength(2);
    expect(screen.queryByText(/This list is incomplete/)).not.toBeInTheDocument();
  });
});
