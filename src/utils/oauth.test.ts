import { describe, expect, it } from 'vitest';
import { safeReturnTo } from './oauth';

describe('safeReturnTo', () => {
  it('keeps same-origin paths with query and hash', () => {
    expect(safeReturnTo('/deployments/abc?tab=outputs#logs')).toBe(
      '/deployments/abc?tab=outputs#logs',
    );
  });

  it.each([
    ['empty', undefined],
    ['absolute URL', 'https://evil.com'],
    ['javascript: URL', 'javascript:alert(1)'],
    ['protocol-relative', '//evil.com'],
    ['backslash host', '/\\evil.com'],
    ['tab-smuggled host', '/\t/evil.com'],
    ['unparseable', '/\\['],
    ['callback route', '/callback?code=x'],
    ['auth callback route', '/auth/callback'],
    ['callback route, other case', '/CALLBACK'],
  ])('rejects %s', (_, input) => {
    expect(safeReturnTo(input)).toBeNull();
  });
});
