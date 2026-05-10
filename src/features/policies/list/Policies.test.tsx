import React from 'react';
import { Policies } from '.';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConfigProvider } from '../../../contexts/ConfigContext';
import { SelectedProjectProvider } from '../../../shared/components/DeploySelectedContext';
import { SelectedProvidersProvider } from '../../root/RootPage/SelectedProvidersContext';
import { policies } from '../../../mocks/policies';
import { projects } from '../../../mocks/projects';

describe('Policies', () => {
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
        // Add any other substrings you want to ignore
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

  // Setup mock responses before each test
  beforeEach(() => {
    server.use(
      http.get(
        'http://localhost:7007/api/proxy/api/infraweave/api/v1/policies/:policyEnvironmnt',
        () => {
          return HttpResponse.json(policies);
        },
      ),
      http.get('http://localhost:7007/api/proxy/api/infraweave/api/v1/projects', () => {
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

  it('should render InfraWeave Overview', async () => {
    render(
      <MemoryRouter>
        <ConfigProvider backendBaseUrl="http://localhost:7007" isStandalone={false}>
          <SelectedProvidersProvider initialProviders={['AWS']}>
            <SelectedProjectProvider>
              <Policies />
            </SelectedProjectProvider>
          </SelectedProvidersProvider>
        </ConfigProvider>
      </MemoryRouter>,
    );
    // Use findByText for asynchronous elements
    expect(await screen.findByText('Policies List')).toBeInTheDocument();
    expect(await screen.findByText(policies[0].policy)).toBeInTheDocument();
    expect(await screen.findByText(policies[0].version)).toBeInTheDocument();
  });
});
