/**
 * Subsequence matching for filter lists, e.g. typing `myprod` to find
 * `myteam-prod-aws`.
 *
 * A plain substring test can't do that, and it is exactly the shape project
 * names take here: several hyphen-separated words, where the parts a user
 * remembers are spread across them.
 */

/** Contiguous characters are far more likely to be what the user meant. */
const ADJACENCY_BONUS = 8;
/** Matching at the start of a word (or the string) is a strong signal. */
const WORD_START_BONUS = 6;
/** Every unmatched character before the first hit costs a little. */
const LEADING_GAP_PENALTY = 1;
/**
 * Ranks every name that literally contains what was typed above every name that
 * only contains it as a scattered subsequence — which the per-character bonuses
 * alone do not: two word-start hits in `process-data` outscore the contiguous run
 * in `app-prod-aws` for the query `prod`, burying the obvious answer.
 *
 * Scaled by query length so it stays decisive: a subsequence has at least one
 * gap, so relative to a contiguous run of the same length it can collect at most
 * one WORD_START_BONUS per character, plus the length-ratio term's 10 points of
 * slack. Being a constant for any one query, it only separates the two groups —
 * within each, the bonuses below still do the ranking.
 */
const substringBonus = (queryLength: number): number => WORD_START_BONUS * queryLength + 12;

const isWordBoundary = (text: string, index: number): boolean =>
  index === 0 || /[^a-z0-9]/i.test(text[index - 1]);

/**
 * Scores `query` against `text`, both matched case-insensitively.
 *
 * @returns a score where higher is a better match, or `null` when `query` is not
 *   a subsequence of `text` at all. An empty query matches everything with score 0.
 */
export const fuzzyScore = (query: string, text: string): number | null => {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return 0;

  const haystack = text.toLowerCase();
  let score = 0;
  let searchFrom = 0;
  let previousIndex = -1;

  for (const char of needle) {
    // Whitespace in the query is treated as "anything may follow", so a name can
    // be found by typing two of its words with a space between them.
    if (char === ' ') continue;

    const index = haystack.indexOf(char, searchFrom);
    if (index === -1) return null;

    if (index === previousIndex + 1) {
      score += ADJACENCY_BONUS;
    } else if (previousIndex === -1) {
      score -= Math.min(index, 10) * LEADING_GAP_PENALTY;
    }
    if (isWordBoundary(haystack, index)) {
      score += WORD_START_BONUS;
    }

    previousIndex = index;
    searchFrom = index + 1;
  }

  if (haystack.includes(needle)) {
    score += substringBonus(needle.length);
  }

  // A query that accounts for most of the name is a better hit than the same
  // query buried in a much longer one.
  return score + Math.round((needle.length / haystack.length) * 10);
};

export const fuzzyMatches = (query: string, text: string): boolean =>
  fuzzyScore(query, text) !== null;

export default fuzzyScore;
