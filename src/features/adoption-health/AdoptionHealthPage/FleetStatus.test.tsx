import React from 'react';
import { render, screen } from '@testing-library/react';
import { FleetGate } from './FleetStatus';
import { FleetDeployments } from './useFleetDeployments';

const fleet = (overrides: Partial<FleetDeployments>): FleetDeployments =>
  ({
    deployments: [],
    fetchedAt: 0,
    accessKnown: true,
    nothingToLoad: false,
    loadingDeployments: false,
    loadFailed: false,
    catalogueIncomplete: false,
    regions: [],
    refresh: () => {},
    ...overrides,
  }) as FleetDeployments;

describe('FleetGate', () => {
  it('draws the view over a loaded fleet', () => {
    render(
      <FleetGate fleet={fleet({ fetchedAt: Date.now(), regions: ['us-west-2'] })}>
        <p>the view</p>
      </FleetGate>,
    );

    expect(screen.getByText('the view')).toBeInTheDocument();
  });

  it('says there is nothing to load, not the cached fleet, once no account has a region', () => {
    render(
      <FleetGate fleet={fleet({ fetchedAt: Date.now(), nothingToLoad: true })}>
        <p>the view</p>
      </FleetGate>,
    );

    expect(screen.getByText(/has a region configured/)).toBeInTheDocument();
    expect(screen.queryByText('the view')).not.toBeInTheDocument();
  });
});
