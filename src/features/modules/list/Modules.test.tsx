import React from 'react';
import { Modules } from '.';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConfigProvider } from '../../../contexts/ConfigContext';
import { SelectedProjectProvider } from '../../../shared/components/DeploySelectedContext';
import { SelectedProvidersProvider } from '../../root/RootPage/SelectedProvidersContext';
import { modules } from '../../../mocks/modules';
import { projects } from '../../../mocks/projects';

describe('Modules', () => {
  const server = setupServer();

  beforeAll(() => server.listen());
  afterAll(() => server.close());

  // Store the original console.error
  const originalConsoleError = console.error;

  beforeAll(() => {
    // Mock console.error to suppress specific warnings
    vi.spyOn(console, 'error').mockImplementation((...args) => {
      const messagesToIgnore = [
        'findDOMNode is deprecated',
        'Support for defaultProps will be removed from',
      ];
      if (messagesToIgnore.some((msg) => args.join(' ').includes(msg))) {
        // If the warning matches one of the ignored patterns, do nothing
        return;
      }
      // Forward other errors to the original console.error
      originalConsoleError(...args);
    });
  });

  afterAll(() => {
    // Restore the original console.error after all tests
    (console.error as ReturnType<typeof vi.spyOn>).mockRestore();
  });

  const backendBaseUrl = 'http://localhost:7007';
  // Setup mock responses before each test
  beforeEach(() => {
    server.use(
      http.get(`${backendBaseUrl}/api/proxy/api/infraweave/api/v1/modules`, () => {
        return HttpResponse.json(modules);
      }),
      http.get(`${backendBaseUrl}/api/proxy/api/infraweave/api/v1/projects`, () => {
        return HttpResponse.json(projects);
      }),
      // Fallback handler for any other GET requests
      http.get('*', () => {
        return HttpResponse.json({ error: 'Unhandled request' }, { status: 500 });
      }),
    );
  });

  afterEach(() => {
    // Reset any runtime handlers after each test to ensure test isolation
    server.resetHandlers();
  });

  const renderModules = () =>
    render(
      <MemoryRouter>
        <ConfigProvider backendBaseUrl="http://localhost:7007" isStandalone={false}>
          <SelectedProvidersProvider initialProviders={['AWS']}>
            <SelectedProjectProvider>
              <Modules />
            </SelectedProjectProvider>
          </SelectedProvidersProvider>
        </ConfigProvider>
      </MemoryRouter>,
    );

  it('should render InfraWeave Overview', async () => {
    renderModules();
    // Use findByText for asynchronous elements
    const lastS3bucketDev = [...modules]
      .filter((m) => m.module === 's3bucket' && m.track === 'dev')
      .pop()!;
    // The "Modules List" caption is gone: the page heading names the list, so
    // repeating it on the table was a duplicate <h*> on the same view.
    expect(await screen.findByText('S3Bucket')).toBeInTheDocument();
    expect(await screen.findByText(lastS3bucketDev.version)).toBeInTheDocument();
  });

  it('follows x-next-token until every module is loaded', async () => {
    // DynamoDB caps a query at 1 MB, so a full registry comes back in pages;
    // stopping at the first one silently hides modules.
    const firstPage = modules.filter((m) => m.module === 's3bucket');
    const secondPage = modules.filter((m) => m.module !== 's3bucket');
    const requestedTokens: (string | null)[] = [];

    server.use(
      http.get(`${backendBaseUrl}/api/proxy/api/infraweave/api/v1/modules`, ({ request }) => {
        const nextToken = new URL(request.url).searchParams.get('next_token');
        requestedTokens.push(nextToken);
        return nextToken
          ? HttpResponse.json(secondPage)
          : HttpResponse.json(firstPage, { headers: { 'x-next-token': 'page-2' } });
      }),
    );

    renderModules();

    // EC2 only exists on the second page, so finding it proves the token was followed.
    expect(await screen.findByText('S3Bucket')).toBeInTheDocument();
    expect(await screen.findByText('EC2')).toBeInTheDocument();
    expect(requestedTokens).toEqual([null, 'page-2']);
  });

  it('keeps rows alphabetical as later pages arrive', async () => {
    // Deliberately serve the pages out of alphabetical order: S3Bucket lands
    // first, EC2 second. Rendering in arrival order would reshuffle rows that
    // the user is already looking at.
    const firstPage = modules.filter((m) => m.module === 's3bucket');
    const secondPage = modules.filter((m) => m.module !== 's3bucket');

    server.use(
      http.get(`${backendBaseUrl}/api/proxy/api/infraweave/api/v1/modules`, ({ request }) => {
        const nextToken = new URL(request.url).searchParams.get('next_token');
        return nextToken
          ? HttpResponse.json(secondPage)
          : HttpResponse.json(firstPage, { headers: { 'x-next-token': 'page-2' } });
      }),
    );

    renderModules();

    await screen.findByText('EC2');
    const rendered = screen.getAllByRole('button', { name: /^(EC2|S3Bucket)$/ });
    expect(rendered.map((button) => button.textContent)).toEqual(['EC2', 'S3Bucket']);
  });

  it('keeps the pages already loaded when a later page fails', async () => {
    // Following every page multiplies the request count, so a mid-load failure is
    // that much likelier. Discarding six good pages because page seven failed
    // would be a worse result than the truncation this hook replaced.
    const firstPage = modules.filter((m) => m.module === 's3bucket');

    server.use(
      http.get(`${backendBaseUrl}/api/proxy/api/infraweave/api/v1/modules`, ({ request }) => {
        const nextToken = new URL(request.url).searchParams.get('next_token');
        return nextToken
          ? HttpResponse.json({ error: 'server error' }, { status: 500 })
          : HttpResponse.json(firstPage, { headers: { 'x-next-token': 'page-2' } });
      }),
    );

    renderModules();

    expect(await screen.findByText(/Failed to fetch modules/)).toBeInTheDocument();
    // The rows from page 1 are still on screen, beside the error.
    expect(screen.getByText('S3Bucket')).toBeInTheDocument();
  });

  it('stops and warns when the next token does not advance', async () => {
    // A backend that keeps handing back the same token would otherwise mean
    // MAX_PAGES requests that each append page 1.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let requests = 0;

    server.use(
      http.get(`${backendBaseUrl}/api/proxy/api/infraweave/api/v1/modules`, () => {
        requests++;
        return HttpResponse.json(modules, { headers: { 'x-next-token': 'stuck' } });
      }),
    );

    renderModules();

    // The incomplete list is surfaced, not left to look like the whole registry.
    expect(await screen.findByText(/This list is incomplete/)).toBeInTheDocument();
    expect(requests).toBe(2);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('repeated next_token'));
    warn.mockRestore();
  });

  it('names the resource, not the URL, when the request fails', async () => {
    // The message is asserted by the e2e suite and read by users, so it says
    // "modules" rather than the full API path and its query string.
    server.use(
      http.get(`${backendBaseUrl}/api/proxy/api/infraweave/api/v1/modules`, () =>
        HttpResponse.json({ error: 'server error' }, { status: 500 }),
      ),
    );

    renderModules();

    expect(await screen.findByText(/Failed to fetch modules/)).toBeInTheDocument();
  });
});
