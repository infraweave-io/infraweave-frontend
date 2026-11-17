import React from 'react';
import { render, screen } from '@testing-library/react';
import { FleetDeployments } from '../adoption-health/AdoptionHealthPage/useFleetDeployments';
import { FleetGate } from './FleetGate';

/** A fleet that has finished loading, with whatever a test overrides. */
const fleet = (overrides: Partial<FleetDeployments> = {}): FleetDeployments => ({
  moduleCatalogue: [],
  stackCatalogue: [],
  projectNames: {},
  projectRegions: {},
  regions: [],
  deployments: [],
  fetchedAt: Date.now(),
  loadingCatalog: false,
  catalogueIncomplete: false,
  accessKnown: true,
  nothingToLoad: false,
  loadingDeployments: false,
  loadFailed: false,
  error: null,
  refresh: () => Promise.resolve(),
  ...overrides,
});

const renderGate = (state: FleetDeployments, extra: { waitForCatalog?: boolean } = {}) =>
  render(
    <FleetGate fleet={state} skeleton={<p>Skeleton</p>} showUpdated {...extra}>
      <p>Content</p>
    </FleetGate>,
  );

describe('FleetGate', () => {
  it('shows the content with an updated footer once loaded', () => {
    const { container } = renderGate(fleet());

    expect(screen.getByText('Content')).toBeInTheDocument();
    expect(container).toHaveTextContent('Updated just now');
  });

  it('leaves the footer out unless asked for', () => {
    const { container } = render(
      <FleetGate fleet={fleet()} skeleton={<p>Skeleton</p>}>
        <p>Content</p>
      </FleetGate>,
    );

    expect(container).not.toHaveTextContent('Updated');
  });

  it('shows the skeleton until the first load arrives', () => {
    renderGate(fleet({ fetchedAt: 0 }));
    expect(screen.getByText('Skeleton')).toBeInTheDocument();
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('shows the skeleton until access is known', () => {
    renderGate(fleet({ accessKnown: false }));
    expect(screen.getByText('Skeleton')).toBeInTheDocument();
  });

  it('only waits for the catalogue when asked to', () => {
    const { unmount } = renderGate(fleet({ loadingCatalog: true }));
    expect(screen.getByText('Content')).toBeInTheDocument();
    unmount();

    renderGate(fleet({ loadingCatalog: true }), { waitForCatalog: true });
    expect(screen.getByText('Skeleton')).toBeInTheDocument();
  });

  it('shows an error instead of loading forever when the first load failed', () => {
    renderGate(fleet({ fetchedAt: 0, loadFailed: true }));
    expect(screen.getByText('Deployments could not be loaded.')).toBeInTheDocument();
    expect(screen.queryByText('Skeleton')).not.toBeInTheDocument();
  });

  it('keeps showing older data when a refresh failed, and says so', () => {
    renderGate(fleet({ loadFailed: true, fetchedAt: Date.now() - 5 * 60 * 1000 }));
    expect(screen.getByText('Content')).toBeInTheDocument();
    expect(
      screen.getByText('The last refresh failed. Showing data from 5 min ago.'),
    ).toBeInTheDocument();
  });

  it('shows the accounts error over everything else', () => {
    renderGate(fleet({ error: new Error('Forbidden'), fetchedAt: 0 }));
    expect(screen.getByText('Could not load accounts')).toBeInTheDocument();
    expect(screen.queryByText('Skeleton')).not.toBeInTheDocument();
  });

  it('explains when there is nothing to load', () => {
    renderGate(fleet({ nothingToLoad: true }));
    expect(screen.getByText(/None of your accounts has a region configured/)).toBeInTheDocument();
  });

  it('flags a fleet that stopped short', () => {
    const { container } = renderGate(fleet({ incomplete: 'page-limit' }));
    expect(screen.getByText('Content')).toBeInTheDocument();
    expect(container).toHaveTextContent('This list is incomplete: loading deployments stopped');
  });
});
