import React, { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import {
  DeploymentExplorerVersionFilter,
  matchesVersionFilter,
  type VersionFilterValue,
} from './deploymentExplorerVersionFilter';

const diagramVersion = '0.0.39-dev+diagram.3';

describe('matchesVersionFilter', () => {
  it('uses exact full-label equality, including build metadata', () => {
    const filter: VersionFilterValue = { operator: '=', value: diagramVersion };

    expect(matchesVersionFilter(diagramVersion, filter)).toBe(true);
    expect(matchesVersionFilter('0.0.39-dev+diagram.4', filter)).toBe(false);
    expect(matchesVersionFilter('0.0.39-dev', filter)).toBe(false);
  });

  it('uses strict SemVer boundaries for less-than and greater-than filters', () => {
    const lessThan: VersionFilterValue = { operator: '<', value: diagramVersion };
    const greaterThan: VersionFilterValue = { operator: '>', value: diagramVersion };

    expect(matchesVersionFilter('0.0.38', lessThan)).toBe(true);
    expect(matchesVersionFilter(diagramVersion, lessThan)).toBe(false);
    expect(matchesVersionFilter('0.0.40', lessThan)).toBe(false);

    expect(matchesVersionFilter('0.0.40', greaterThan)).toBe(true);
    expect(matchesVersionFilter(diagramVersion, greaterThan)).toBe(false);
    expect(matchesVersionFilter('0.0.38', greaterThan)).toBe(false);
  });

  it('orders prereleases before their corresponding release', () => {
    const lessThanRelease: VersionFilterValue = { operator: '<', value: '0.0.39' };
    const greaterThanPrerelease: VersionFilterValue = { operator: '>', value: diagramVersion };

    expect(matchesVersionFilter(diagramVersion, lessThanRelease)).toBe(true);
    expect(matchesVersionFilter('0.0.39', lessThanRelease)).toBe(false);
    expect(matchesVersionFilter('0.0.39', greaterThanPrerelease)).toBe(true);
  });

  it('includes both endpoints in a between filter', () => {
    const filter: VersionFilterValue = {
      operator: 'between',
      value: diagramVersion,
      upperValue: '0.0.40',
    };

    expect(matchesVersionFilter(diagramVersion, filter)).toBe(true);
    expect(matchesVersionFilter('0.0.40', filter)).toBe(true);
    expect(matchesVersionFilter('0.0.38', filter)).toBe(false);
    expect(matchesVersionFilter('0.0.41', filter)).toBe(false);
  });

  it('does not match invalid deployment versions against ranges', () => {
    const invalidDataVersion = '0.0.2-dev+some_branch.5';

    expect(matchesVersionFilter(invalidDataVersion, { operator: '<', value: '1.0.0' })).toBe(false);
    expect(matchesVersionFilter(invalidDataVersion, { operator: '>', value: '0.0.1' })).toBe(false);
    expect(
      matchesVersionFilter(invalidDataVersion, {
        operator: 'between',
        value: '0.0.1',
        upperValue: '1.0.0',
      }),
    ).toBe(false);
  });
});

const versions = [diagramVersion, '0.0.40', '0.0.2-dev+some_branch.5'];

const VersionFilterHarness = () => {
  const [filter, setFilter] = useState<VersionFilterValue>();
  const visibleVersions = versions.filter((version) => matchesVersionFilter(version, filter));

  return (
    <>
      <DeploymentExplorerVersionFilter value={filter} onChange={setFilter} />
      <ul aria-label="Visible deployments">
        {visibleVersions.map((version) => (
          <li key={version}>{version}</li>
        ))}
      </ul>
    </>
  );
};

describe('DeploymentExplorerVersionFilter', () => {
  it('leaves rows unfiltered and displays validation for an invalid range operand', async () => {
    const user = userEvent.setup();
    render(<VersionFilterHarness />);

    await user.click(screen.getByRole('combobox', { name: 'Operator' }));
    await user.click(screen.getByRole('option', { name: '<' }));
    await user.type(screen.getByRole('textbox', { name: 'Version' }), 'not-semver');
    expect(screen.getByRole('textbox', { name: 'Version' })).toHaveValue('not-semver');

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid SemVer version');
    expect(screen.getAllByRole('listitem')).toHaveLength(versions.length);
  });

  it('leaves rows unfiltered until both range operands are valid', async () => {
    const user = userEvent.setup();
    render(<VersionFilterHarness />);

    await user.click(screen.getByRole('combobox', { name: 'Operator' }));
    await user.click(screen.getByRole('option', { name: 'between' }));

    expect(screen.getByRole('textbox', { name: 'From version' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'To version' })).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'From version' }), '0.0.39');
    expect(screen.getByRole('textbox', { name: 'From version' })).toHaveValue('0.0.39');
    await user.type(screen.getByRole('textbox', { name: 'To version' }), 'not-semver');
    expect(screen.getByRole('textbox', { name: 'To version' })).toHaveValue('not-semver');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid upper SemVer version');
    expect(screen.getAllByRole('listitem')).toHaveLength(versions.length);
  });

  it('does not apply an incomplete range whose supplied bounds are invalid or reversed', () => {
    const { rerender } = render(
      <DeploymentExplorerVersionFilter
        value={{ operator: 'between', value: '0.0.40' }}
        onChange={() => undefined}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Enter an upper version');

    rerender(
      <DeploymentExplorerVersionFilter
        value={{ operator: 'between', value: '0.0.40', upperValue: '0.0.39' }}
        onChange={() => undefined}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Upper version must be greater than or equal',
    );
  });
});
