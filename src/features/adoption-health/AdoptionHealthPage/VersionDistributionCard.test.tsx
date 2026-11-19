import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { Deployment } from '../../../types/Deployment';
import { VersionDistributionCard } from './VersionDistributionCard';

vi.mock('@mui/x-charts/BarChart', () => ({ BarChart: () => null }));

const deployments = [
  ...Array.from({ length: 3 }, () => '1.9.0'),
  '1.10.0',
  '1.10.0',
  '2.0.0-beta.1',
  '2.0.0',
  'not-semver',
].map(
  (module_version, index) =>
    ({
      deployment_id: `d${index}`,
      status: 'succeeded',
      region: 'eu-west-1',
      module_version,
    }) as Deployment,
);

const renderedVersions = () =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getByRole('button').textContent);

describe('VersionDistributionCard sorting', () => {
  it('defaults to semver descending, with unparsable versions last', () => {
    render(
      <VersionDistributionCard kind="module" deployments={deployments} onVersionClick={vi.fn()} />,
    );
    expect(renderedVersions()).toEqual(['2.0.0', '2.0.0-beta.1', '1.10.0', '1.9.0', 'not-semver']);
  });

  it('sorts ascending on request', async () => {
    render(
      <VersionDistributionCard kind="module" deployments={deployments} onVersionClick={vi.fn()} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Asc' }));
    expect(renderedVersions()).toEqual(['1.9.0', '1.10.0', '2.0.0-beta.1', '2.0.0', 'not-semver']);
  });

  it('sorts by count and breaks ties by version', async () => {
    render(
      <VersionDistributionCard kind="module" deployments={deployments} onVersionClick={vi.fn()} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Count' }));
    expect(renderedVersions()).toEqual(['1.9.0', '1.10.0', '2.0.0', '2.0.0-beta.1', 'not-semver']);
  });
});
