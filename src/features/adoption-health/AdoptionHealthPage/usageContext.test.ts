import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Deployment } from '../../../types/Deployment';
import { filterSummary, matchesFilters, usageHref, useUsageContext } from './usageContext';

describe('usageHref', () => {
  it('links to a usage page with its context in the query', () => {
    expect(usageHref('module-usage', { module: 'vpc', region: 'eu-central-1' })).toBe(
      '/infraweave/adoption-health/module-usage?module=vpc&region=eu-central-1',
    );
  });

  it('leaves out keys that are not set', () => {
    expect(usageHref('account-usage', { account: '111111111111', region: undefined })).toBe(
      '/infraweave/adoption-health/account-usage?account=111111111111',
    );
    expect(usageHref('region-usage', {})).toBe('/infraweave/adoption-health/region-usage');
  });

  it('says whether the module is a module or a stack, next to it', () => {
    expect(usageHref('account-usage', { module: 'net', kind: 'stack', account: '1' })).toBe(
      '/infraweave/adoption-health/account-usage?module=net&kind=stack&account=1',
    );
  });

  it('leaves out a kind with no module to qualify', () => {
    expect(usageHref('region-usage', { kind: 'stack', region: 'eu-west-1' })).toBe(
      '/infraweave/adoption-health/region-usage?region=eu-west-1',
    );
  });

  it('escapes names that are not URL-safe', () => {
    expect(usageHref('module-usage', { module: 'a b&c' })).toBe(
      '/infraweave/adoption-health/module-usage?module=a+b%26c',
    );
  });
});

describe('matchesFilters', () => {
  const d = {
    module: 'vpc',
    region: 'eu-central-1',
    project_id: '111111111111',
  } as Deployment;

  it('matches everything when no filter is set', () => {
    expect(matchesFilters(d, {})).toBe(true);
  });

  it('needs every filter that is set to match', () => {
    expect(matchesFilters(d, { region: 'eu-central-1', account: '111111111111' })).toBe(true);
    expect(matchesFilters(d, { region: 'eu-central-1', account: '222222222222' })).toBe(false);
    expect(matchesFilters(d, { module: 's3bucket' })).toBe(false);
  });

  it('keeps a module and a stack of the same name apart when the kind is given', () => {
    const isStack = (deployment: Deployment) => deployment.module_type === 'stack';
    const stack = { ...d, module_type: 'stack' } as Deployment;

    expect(matchesFilters(stack, { module: 'vpc', kind: 'stack' }, isStack)).toBe(true);
    expect(matchesFilters(stack, { module: 'vpc', kind: 'module' }, isStack)).toBe(false);
    expect(matchesFilters(d, { module: 'vpc', kind: 'module' }, isStack)).toBe(true);
  });
});

describe('filterSummary', () => {
  it('names the filters in one line, with display names', () => {
    expect(
      filterSummary({ region: 'eu-west-1', account: '111111111111' }, { '111111111111': 'Dev' }),
    ).toBe('Showing only Region: eu-west-1 (Ireland), Account: Dev');
  });

  it('names a stack filter as a stack', () => {
    expect(filterSummary({ module: 'webapp', kind: 'stack' }, {})).toBe(
      'Showing only Stack: webapp',
    );
    expect(filterSummary({ module: 'vpc', kind: 'module' }, {})).toBe('Showing only Module: vpc');
  });

  it('is undefined without filters', () => {
    expect(filterSummary({}, {})).toBeUndefined();
  });
});

describe('useUsageContext', () => {
  const renderAt = (url: string) =>
    renderHook(() => useUsageContext(), {
      wrapper: ({ children }) =>
        React.createElement(MemoryRouter, { initialEntries: [url] }, children),
    });

  it('reads the kind only next to a module', () => {
    expect(renderAt('/?module=net&kind=stack').result.current.context).toEqual({
      module: 'net',
      kind: 'stack',
    });
    expect(renderAt('/?kind=stack&region=eu-west-1').result.current.context).toEqual({
      region: 'eu-west-1',
    });
  });

  it('drops the kind when the module it qualified changes', () => {
    const { result } = renderAt('/?module=net&kind=stack');

    act(() => result.current.set('module', 'vpc'));

    expect(result.current.context).toEqual({ module: 'vpc' });
  });
});
