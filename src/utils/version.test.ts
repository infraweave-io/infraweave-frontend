import { compareVersions, shortenVersion } from './version';

describe('shortenVersion', () => {
  it('elides the middle of a long commit sha in build metadata', () => {
    expect(shortenVersion('0.0.0-dev+e9eb0882e5663e6bc2b9e2591e7d11bd8e743281')).toBe(
      '0.0.0-dev+e9eb088...281',
    );
  });

  it('keeps the semver core intact', () => {
    // The part before '+' is what identifies the release, so it is never cut.
    expect(shortenVersion('1.12.3-beta.4+e9eb0882e5663e6bc2b9e2591e7d11bd')).toBe(
      '1.12.3-beta.4+e9eb088...1bd',
    );
  });

  it('leaves ordinary versions untouched', () => {
    expect(shortenVersion('1.2.3')).toBe('1.2.3');
    expect(shortenVersion('1.2.3-beta.1+abc1234')).toBe('1.2.3-beta.1+abc1234');
  });

  it('still shortens a long version whose metadata is too short to elide', () => {
    // The metadata branch is an optimisation, not an exit: a long version with
    // short metadata has to be elided some other way or it widens the column.
    expect(shortenVersion('0.0.36-dev-featurebranch+test.11')).toBe('0.0.36-dev...+test.11');
  });

  it('elides long versions that carry no build metadata', () => {
    expect(shortenVersion('1.2.3-a-very-long-prerelease-identifier')).toBe('1.2.3-a-ve...entifier');
  });

  it('treats only the first + as the metadata separator', () => {
    expect(shortenVersion('1.2.3+build+e9eb0882e5663e6bc2b9e2591e7d')).toBe('1.2.3+build+e...e7d');
  });

  it('handles an empty version', () => {
    expect(shortenVersion('')).toBe('');
  });
});

describe('compareVersions', () => {
  const sorted = (versions: string[], order: 'asc' | 'desc' = 'asc') =>
    [...versions].sort((a, b) => compareVersions(a, b, order));

  it('compares the core numerically, not as text', () => {
    expect(sorted(['1.10.0', '1.2.0', '1.9.9', '10.0.0'])).toEqual([
      '1.2.0',
      '1.9.9',
      '1.10.0',
      '10.0.0',
    ]);
  });

  it('ranks a release above its own prereleases', () => {
    expect(sorted(['1.2.3', '1.2.3-beta.1', '1.2.2', '1.2.4-dev'])).toEqual([
      '1.2.2',
      '1.2.3-beta.1',
      '1.2.3',
      '1.2.4-dev',
    ]);
  });

  it('follows the semver spec example chain for prereleases', () => {
    const chain = [
      '1.0.0-alpha',
      '1.0.0-alpha.1',
      '1.0.0-alpha.beta',
      '1.0.0-beta',
      '1.0.0-beta.2',
      '1.0.0-beta.11',
      '1.0.0-rc.1',
      '1.0.0',
    ];
    expect(sorted([...chain].reverse())).toEqual(chain);
  });

  it('orders dev builds by their numeric build counter', () => {
    expect(sorted(['0.0.36-dev+test.10', '0.0.36-dev+test.6', '0.0.36-dev+test.11'])).toEqual([
      '0.0.36-dev+test.6',
      '0.0.36-dev+test.10',
      '0.0.36-dev+test.11',
    ]);
  });

  it('compares zero-padded build counters by value', () => {
    expect(sorted(['1.0.0+test.10', '1.0.0+test.006', '1.0.0+test.7'])).toEqual([
      '1.0.0+test.006',
      '1.0.0+test.7',
      '1.0.0+test.10',
    ]);
    expect(sorted(['1.0.0+test.6', '1.0.0+test.006'])).toEqual(
      sorted(['1.0.0+test.006', '1.0.0+test.6']),
    );
  });

  it('ranks the same prerelease without metadata before the one with metadata', () => {
    expect(sorted(['0.0.36-dev+test.1', '0.0.36-dev'])).toEqual([
      '0.0.36-dev',
      '0.0.36-dev+test.1',
    ]);
  });

  it('gives sha-only dev builds a stable order', () => {
    const shas = ['0.0.0-dev+bbbb', '0.0.0-dev+aaaa'];
    expect(sorted(shas)).toEqual(sorted([...shas].reverse()));
    expect(sorted(shas)).toEqual(['0.0.0-dev+aaaa', '0.0.0-dev+bbbb']);
  });

  it('puts versions that are not valid semver last in both directions', () => {
    const mixed = ['not-semver', '1.0.0', 'main', '2.0.0'];
    expect(sorted(mixed, 'asc')).toEqual(['1.0.0', '2.0.0', 'main', 'not-semver']);
    expect(sorted(mixed, 'desc')).toEqual(['2.0.0', '1.0.0', 'not-semver', 'main']);
  });

  it('reverses valid versions for desc', () => {
    expect(sorted(['1.0.0', '1.0.0-beta', '0.9.0'], 'desc')).toEqual([
      '1.0.0',
      '1.0.0-beta',
      '0.9.0',
    ]);
  });
});
