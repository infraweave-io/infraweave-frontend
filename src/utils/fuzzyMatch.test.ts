import { fuzzyScore, fuzzyMatches } from './fuzzyMatch';

describe('fuzzyScore', () => {
  it('matches an exact substring', () => {
    expect(fuzzyMatches('team', 'myteam-prod-aws')).toBe(true);
  });

  it('matches characters spread across words', () => {
    // The whole point: `myprod` is not a substring of anything.
    expect(fuzzyMatches('myprod', 'myteam-prod-aws')).toBe(true);
  });

  it('rejects characters that are not there', () => {
    expect(fuzzyScore('myz', 'myteam-prod-aws')).toBeNull();
  });

  it('rejects characters that are there but out of order', () => {
    expect(fuzzyScore('proddev', 'alpha-dev-aws')).toBeNull();
  });

  it('is case-insensitive both ways', () => {
    expect(fuzzyMatches('MYAPP', 'myapp-dev-aws')).toBe(true);
    expect(fuzzyMatches('myapp', 'MYAPP-DEV-AWS')).toBe(true);
  });

  it('treats an empty or blank query as matching everything', () => {
    expect(fuzzyScore('', 'anything')).toBe(0);
    expect(fuzzyScore('   ', 'anything')).toBe(0);
  });

  it('lets a space stand in for any gap', () => {
    expect(fuzzyMatches('myapp stg', 'myapptool-stg-aws')).toBe(true);
  });

  it('ranks a contiguous match above a scattered one', () => {
    const contiguous = fuzzyScore('dev', 'dev-aws')!;
    const scattered = fuzzyScore('dev', 'data-envoy-vault')!;
    expect(contiguous).toBeGreaterThan(scattered);
  });

  it('ranks a literal substring above a scattered subsequence', () => {
    // The whole name is a hit for `prod` in one case and an accident of spelling
    // in the other, so word-start bonuses must not put the accident first.
    const substring = fuzzyScore('prod', 'app-prod-aws')!;
    const subsequence = fuzzyScore('prod', 'process-data')!;
    expect(substring).toBeGreaterThan(subsequence);
  });

  it('ranks a prefix match above a match in the middle', () => {
    const prefix = fuzzyScore('abc', 'abc-dev-aws')!;
    const middle = fuzzyScore('abc', 'xyz-abc-aws')!;
    expect(prefix).toBeGreaterThan(middle);
  });

  it('ranks a word-start match above one inside a word', () => {
    const wordStart = fuzzyScore('dev', 'alpha-dev-aws')!;
    const insideWord = fuzzyScore('dev', 'aardevark-aws')!;
    expect(wordStart).toBeGreaterThan(insideWord);
  });

  it('prefers the shorter of two equally-structured names', () => {
    const short = fuzzyScore('abcd', 'abcd-dev')!;
    const long = fuzzyScore('abcd', 'abcd-dev-aws-extra-long-suffix')!;
    expect(short).toBeGreaterThan(long);
  });
});
