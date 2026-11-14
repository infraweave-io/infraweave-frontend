import React, { useMemo, useState } from 'react';
import { Box, Typography } from '@mui/material';
import camelCase from 'camelcase';
import { bestFuzzyScore, bestSubstringScore } from '../../utils/fuzzyMatch';
import { SearchField } from './SearchField';

/** The fields of a Terraform variable or output the search looks at. */
interface Searchable {
  name: string;
  description?: string | null;
}

/**
 * The names a variable can be looked up by: the Terraform name, the camelCase
 * name a manifest uses, and for stack variables the sub-claim and the property
 * on their own — so `bucket1a` lists everything that claim takes, and
 * `bucketName` finds that property across every claim.
 */
const searchableNames = (name: string): string[] => {
  const [prefix, propertyName] = name.split('__');
  return propertyName
    ? [name, prefix, propertyName, camelCase(propertyName)]
    : [name, camelCase(name)];
};

/**
 * Scores a variable against the filter, or `null` when it doesn't match. Names
 * are matched as a subsequence, like every other filter here; the description
 * only by literal text, since free prose would answer to almost any query
 * otherwise. Name hits rank above description-only hits.
 */
const scoreVariable = (query: string, variable: Searchable): [number, number] | null => {
  const nameScore = bestFuzzyScore(query, searchableNames(variable.name));
  if (nameScore !== null) return [1, nameScore];

  const descriptionScore = bestSubstringScore(query, [variable.description]);
  return descriptionScore !== null ? [0, descriptionScore] : null;
};

/** Keeps the order the list was given in. Module-level so `useMemo` sees one function. */
const keepOrder = () => 0;

/**
 * Filter state for a list of module/stack variables or outputs.
 *
 * @param compare the list's own order, used as-is while not searching and as
 *   the tie-break between equally good matches while searching.
 */
export const useVariableSearch = <T extends Searchable>(
  items: T[] | undefined,
  compare: (a: T, b: T) => number = keepOrder,
) => {
  const [query, setQuery] = useState('');
  const searching = query.trim() !== '';

  const visible = useMemo(() => {
    const all = items ?? [];
    if (!searching) return all.slice().sort(compare);

    return (
      all
        .map((item) => ({ item, score: scoreVariable(query, item) }))
        .filter((entry): entry is { item: T; score: [number, number] } => !!entry.score)
        // While searching, match quality orders the list, so the best hit is on top
        // rather than wherever the list's usual order would put it.
        .sort(
          (a, b) => b.score[0] - a.score[0] || b.score[1] - a.score[1] || compare(a.item, b.item),
        )
        .map((entry) => entry.item)
    );
  }, [items, query, searching, compare]);

  const total = items?.length ?? 0;

  return { query, setQuery, searching, visible, total, hiddenCount: total - visible.length };
};

export interface VariableListHeaderProps {
  title: string;
  /** e.g. "inputs" — used in the placeholder. */
  noun: string;
  search: ReturnType<typeof useVariableSearch<any>>;
}

/** A panel's title with its search box and, while filtering, how much is hidden. */
export const VariableListHeader: React.FC<VariableListHeaderProps> = ({ title, noun, search }) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 1.5,
      mb: 2,
      flexWrap: 'wrap',
    }}
  >
    <Typography variant="h6">{title}</Typography>
    {/* Hidden while there is nothing to filter. */}
    {search.total > 0 && (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        {search.hiddenCount > 0 && search.visible.length > 0 && (
          // Announced because the list below changes as the query is typed,
          // with no other cue.
          <Typography variant="caption" color="text.secondary" role="status">
            {search.hiddenCount} hidden by search
          </Typography>
        )}
        <SearchField
          value={search.query}
          onChange={search.setQuery}
          placeholder={`Search ${noun}`}
          sx={{ width: 220 }}
        />
      </Box>
    )}
  </Box>
);
