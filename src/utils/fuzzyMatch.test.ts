import { fuzzyScore, fuzzyMatches, bestFuzzyScore, bestSubstringScore } from './fuzzyMatch';

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

describe('bestFuzzyScore', () => {
  // A deployment row: name, module, namespace, region.
  const row = ['ec2_instance_1', 'ec2', 'dev', 'eu-central-1'];

  it('matches on any one field', () => {
    expect(bestFuzzyScore('instance', row)).not.toBeNull();
    expect(bestFuzzyScore('eu-central', row)).not.toBeNull();
  });

  it('scores the field that matches best', () => {
    // 'dev' is the whole of one field and absent from the rest, so the score is
    // that field's — not a worse one from a field that happens to match too.
    expect(bestFuzzyScore('dev', row)).toBe(fuzzyScore('dev', 'dev'));
  });

  it('does not match characters spread across separate fields', () => {
    // The point of scoring per field: 'ec2central' is a subsequence of the fields
    // joined together, but of nothing the user can actually see in one place.
    expect(bestFuzzyScore('ec2central', row)).toBeNull();
  });

  it('ignores blank and missing fields', () => {
    // Rows carry optional columns; an absent one must not become a match.
    expect(bestFuzzyScore('x', ['', undefined, null])).toBeNull();
    expect(bestFuzzyScore('dev', ['', undefined, 'dev'])).not.toBeNull();
  });

  it('treats an empty query as matching everything', () => {
    // Callers skip filtering entirely when nothing is typed, so this only has to
    // be harmless — but returning null would hide every row if one ever did not.
    expect(bestFuzzyScore('', row)).toBe(0);
    expect(bestFuzzyScore('  ', [])).toBe(0);
  });
});

describe('bestSubstringScore', () => {
  // The wide values rows share: an account name and a status.
  const row = ['Dev Account 22', 'successful'];

  it('matches a field that contains the query', () => {
    expect(bestSubstringScore('account', row)).not.toBeNull();
    // Case-insensitive, and a space in the query is part of the text here rather
    // than the "any gap" it means to the fuzzy matcher.
    expect(bestSubstringScore('dev account', row)).not.toBeNull();
  });

  it('rejects a query the field only contains the scattered letters of', () => {
    // The reason this variant exists: `ec2` is a subsequence of "Dev Account 22",
    // so fuzzy-matching an account name matched every row filed under it.
    expect(bestSubstringScore('ec2', row)).toBeNull();
    expect(bestFuzzyScore('ec2', row)).not.toBeNull();
  });

  it('scores on the same scale as the fuzzy matcher, so the two can be compared', () => {
    // Callers take the best of both over different field sets, which only means
    // anything if the numbers are comparable.
    expect(bestSubstringScore('account', row)).toBe(bestFuzzyScore('account', row));
  });

  it('treats an empty query as matching everything', () => {
    expect(bestSubstringScore('', row)).toBe(0);
    expect(bestSubstringScore('  ', [])).toBe(0);
  });
});
