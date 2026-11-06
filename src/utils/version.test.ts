import { shortenVersion } from './version';

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
