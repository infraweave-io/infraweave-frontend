import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Deployment } from '../../../types/Deployment';
import { matchesFilters, usageHref, useUsageContext } from './usageContext';

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
  it('carries only non-default module usage modes through drill-down links', () => {
    expect(
      usageHref('account-usage', {
        module: 's3bucket',
        kind: 'module',
        account: '1',
        moduleUsageMode: 'in-stacks',
      }),
    ).toBe(
      '/infraweave/adoption-health/account-usage?module=s3bucket&kind=module&account=1&moduleUsageMode=in-stacks',
    );
    expect(
      usageHref('region-usage', {
        module: 's3bucket',
        kind: 'module',
        region: 'us-east-1',
        moduleUsageMode: 'standalone',
      }),
    ).toBe(
      '/infraweave/adoption-health/region-usage?module=s3bucket&kind=module&region=us-east-1&moduleUsageMode=standalone',
    );
    expect(usageHref('region-usage', { module: 's3bucket', moduleUsageMode: 'both' })).toBe(
      '/infraweave/adoption-health/region-usage?module=s3bucket',
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
    expect(matchesFilters(d, { region: 'us-east-1' })).toBe(false);
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

describe('useUsageContext', () => {
  const renderAt = (url: string) =>
    renderHook(() => useUsageContext(), {
      wrapper: ({ children }) =>
        React.createElement(MemoryRouter, { initialEntries: [url] }, children),
    });

  it('defaults a missing or invalid mode to both and reads mode separately from kind', () => {
    expect(renderAt('/?module=net&kind=stack').result.current.context).toEqual({
      module: 'net',
      kind: 'stack',
      moduleUsageMode: 'both',
    });
    expect(
      renderAt('/?module=net&kind=module&moduleUsageMode=in-stacks').result.current.context,
    ).toEqual({
      module: 'net',
      kind: 'module',
      moduleUsageMode: 'in-stacks',
    });
    expect(
      renderAt('/?kind=stack&region=eu-west-1&moduleUsageMode=unknown').result.current.context,
    ).toEqual({
      region: 'eu-west-1',
      moduleUsageMode: 'both',
    });
  });

  it('drops kind when module changes without changing its separate usage mode', () => {
    const { result } = renderAt('/?module=net&kind=module&moduleUsageMode=standalone');

    act(() => result.current.set('module', 'vpc'));

    expect(result.current.context).toEqual({ module: 'vpc', moduleUsageMode: 'standalone' });
  });

  it('changes the usage mode in place and keeps a non-default mode in the query', () => {
    const { result } = renderAt('/?module=s3bucket&kind=module&account=1');

    act(() => result.current.setModuleUsageMode('standalone'));
    expect(result.current.context).toEqual({
      module: 's3bucket',
      kind: 'module',
      account: '1',
      moduleUsageMode: 'standalone',
    });

    act(() => result.current.setModuleUsageMode('both'));
    expect(result.current.context).toEqual({
      module: 's3bucket',
      kind: 'module',
      account: '1',
      moduleUsageMode: 'both',
    });
  });
});
