import { describe, expect, it } from 'vitest';
import { resolveInternalLink } from './chatLinks';

describe('resolveInternalLink', () => {
  it.each([
    'overview',
    'deployments',
    'stacks',
    'modules',
    'providers',
    'policies',
    'projects',
    'adoption-health',
  ])('accepts the %s tab', (tab) => {
    expect(resolveInternalLink(`/infraweave/${tab}`)).toBe(`/infraweave/${tab}`);
  });

  it('rejects a tab the app does not have', () => {
    expect(resolveInternalLink('/infraweave/billing')).toBeNull();
    expect(resolveInternalLink('/infraweave')).toBeNull();
  });

  it.each([
    'module-usage',
    'stack-usage',
    'deployment-explorer',
    'region-usage',
    'account-usage',
    'velocity',
    'health',
    'issues',
  ])('accepts the adoption-health %s view', (view) => {
    expect(resolveInternalLink(`/infraweave/adoption-health/${view}`)).toBe(
      `/infraweave/adoption-health/${view}`,
    );
  });

  it('rejects an adoption-health view the app would silently show the dashboard for', () => {
    expect(resolveInternalLink('/infraweave/adoption-health/nonsense')).toBeNull();
    // A redirect, not a page of its own.
    expect(resolveInternalLink('/infraweave/adoption-health/usage')).toBeNull();
  });

  it('keeps the usage filters the usage pages read', () => {
    expect(
      resolveInternalLink('/infraweave/adoption-health/module-usage?module=s3bucket&kind=module'),
    ).toBe('/infraweave/adoption-health/module-usage?module=s3bucket&kind=module');
    expect(
      resolveInternalLink(
        '/infraweave/adoption-health/region-usage?region=eu-central-1&account=123456789012',
      ),
    ).toBe('/infraweave/adoption-health/region-usage?region=eu-central-1&account=123456789012');
  });

  it.each(['standalone', 'in-stacks', 'both'])(
    'keeps the %s usage source on a usage page',
    (mode) => {
      const href = `/infraweave/adoption-health/module-usage?module=s3bucket&moduleUsageMode=${mode}`;
      expect(resolveInternalLink(href)).toBe(href);
    },
  );

  it('rejects a usage source the page does not know', () => {
    expect(
      resolveInternalLink(
        '/infraweave/adoption-health/module-usage?module=s3bucket&moduleUsageMode=everywhere',
      ),
    ).toBeNull();
    expect(
      resolveInternalLink('/infraweave/modules?module=s3bucket&moduleUsageMode=in-stacks'),
    ).toBeNull();
    expect(
      resolveInternalLink('/infraweave/adoption-health/velocity?moduleUsageMode=in-stacks'),
    ).toBeNull();
  });

  it('rejects a query the page would ignore or misread', () => {
    expect(resolveInternalLink('/infraweave/adoption-health/module-usage?foo=bar')).toBeNull();
    expect(resolveInternalLink('/infraweave/adoption-health/module-usage?kind=widget')).toBeNull();
    expect(resolveInternalLink('/infraweave/modules?module=vpc')).toBeNull();
    expect(resolveInternalLink('/infraweave/adoption-health/velocity?module=vpc')).toBeNull();
  });

  it('accepts a deployment with and without a tab', () => {
    const base = '/infraweave/deployment/123456789012/eu-central-1/prod/payments-api';
    expect(resolveInternalLink(base)).toBe(base);
    expect(resolveInternalLink(`${base}/events`)).toBe(`${base}/events`);
    expect(resolveInternalLink(`${base}/overview`)).toBe(`${base}/overview`);
  });

  it('rejects a deployment that is missing a part or has an unknown tab', () => {
    expect(resolveInternalLink('/infraweave/deployment/123456789012/eu-central-1/prod')).toBeNull();
    expect(
      resolveInternalLink('/infraweave/deployment/123456789012/eu-central-1/prod/api/secrets'),
    ).toBeNull();
  });

  it.each(['module', 'stack', 'provider'])('accepts a %s version page', (kind) => {
    expect(resolveInternalLink(`/infraweave/${kind}/stable/thing/1.2.3`)).toBe(
      `/infraweave/${kind}/stable/thing/1.2.3`,
    );
  });

  it('accepts a policy version page', () => {
    expect(resolveInternalLink('/infraweave/policy/prod/no-public-s3/0.4.0')).toBe(
      '/infraweave/policy/prod/no-public-s3/0.4.0',
    );
  });

  it('rejects a version page with a missing or extra part', () => {
    expect(resolveInternalLink('/infraweave/module/stable/s3bucket')).toBeNull();
    expect(resolveInternalLink('/infraweave/module/stable/s3bucket/1.0.0/extra')).toBeNull();
    expect(resolveInternalLink('/infraweave/policy/prod/no-public-s3')).toBeNull();
  });

  it('accepts encoded characters in a segment', () => {
    expect(resolveInternalLink('/infraweave/module/stable/my%20mod/1.0.0')).toBe(
      '/infraweave/module/stable/my%20mod/1.0.0',
    );
  });

  it('rejects anything that is not a plain in-app path', () => {
    expect(resolveInternalLink('https://example.com/infraweave/modules')).toBeNull();
    expect(resolveInternalLink('//evil.example/infraweave/modules')).toBeNull();
    expect(resolveInternalLink('javascript:alert(1)')).toBeNull();
    expect(resolveInternalLink('infraweave/modules')).toBeNull();
    expect(resolveInternalLink('/other/modules')).toBeNull();
    expect(resolveInternalLink('/infraweave/module/stable/../1.0.0')).toBeNull();
    expect(resolveInternalLink('/infraweave/module/stable//1.0.0')).toBeNull();
    expect(resolveInternalLink('')).toBeNull();
    expect(resolveInternalLink(undefined)).toBeNull();
  });

  it('drops a hash instead of passing it on', () => {
    expect(resolveInternalLink('/infraweave/modules#top')).toBe('/infraweave/modules');
  });

  it('tolerates a trailing slash', () => {
    expect(resolveInternalLink('/infraweave/modules/')).toBe('/infraweave/modules');
  });
});
