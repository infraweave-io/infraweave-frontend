import {
  Box,
  FormControlLabel,
  Checkbox,
  CircularProgress,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Close';

import React, { useMemo, useState } from 'react';
import { ResponseErrorPanel } from '../../../standalone/components/ComponentAdapter';
import { FilterGroup } from '../../../shared/components/FilterGroup';
import { useSelectedProjects } from './SelectedProjectsContext';
import { fuzzyScore } from '../../../utils/fuzzyMatch';

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

const EnvFilterPanel = () => {
  // The panel used to fetch projects itself, duplicating the context's copy and
  // spinning on every mount. The context serves a cached list immediately and
  // refreshes it in the background, so an added or removed project appears on its
  // own without the list ever blanking out.
  const {
    projects,
    loadingProjects,
    projectsError,
    selectedProjectNames,
    availableRegions,
    selectedRegions,
    toggleProjectSelection,
    toggleRegionSelection,
  } = useSelectedProjects();

  const [query, setQuery] = useState('');
  const searching = query.trim() !== '';

  // Check if a project is selected based on the context state
  const isProjectSelected = (projectName: string): boolean => {
    return selectedProjectNames.includes(projectName);
  };

  // Which projects are pinned is decided when the query changes (and on mount),
  // not on every toggle: ordering on the live selection moved rows under the
  // cursor as they were ticked, so the second of two adjacent boxes was never
  // where the user had just aimed. Ticking a box still ticks it — only the
  // pinning waits for the next search.
  const [pinned, setPinned] = useState<string[]>(selectedProjectNames);
  const [pinnedForQuery, setPinnedForQuery] = useState(query);
  if (pinnedForQuery !== query) {
    setPinnedForQuery(query);
    setPinned(selectedProjectNames);
  }

  // With no query, pinned projects sit at the top so the filter in effect stays
  // visible without scrolling a long list. With one, match quality decides
  // instead: pinning there buries the best match below however many projects
  // happen to be selected, which for fifteen of them is off the bottom.
  const { matches, unmatchedPinned } = useMemo(() => {
    const isPinned = (name: string) => pinned.includes(name);
    const scored = projects.map((project) => ({
      project,
      score: fuzzyScore(query, project.name),
    }));

    return {
      matches: scored
        .filter(
          (entry): entry is { project: (typeof projects)[number]; score: number } =>
            entry.score !== null,
        )
        .sort(
          (a, b) =>
            (searching ? 0 : Number(isPinned(b.project.name)) - Number(isPinned(a.project.name))) ||
            b.score - a.score ||
            byName(a.project, b.project),
        )
        .map((entry) => entry.project),
      // A pinned project is never hidden outright: it is the filter currently in
      // effect on the list next to it, so it has to stay togglable — but below
      // the matches, and labelled, rather than pretending to be a search result.
      unmatchedPinned: scored
        .filter((entry) => entry.score === null && isPinned(entry.project.name))
        .map((entry) => entry.project)
        .sort(byName),
    };
  }, [projects, query, pinned, searching]);

  const hiddenCount = projects.length - matches.length - unmatchedPinned.length;

  const projectCheckbox = (project: { project_id: string; name: string }) => (
    <FormControlLabel
      key={project.project_id}
      control={
        <Checkbox
          size="small"
          checked={isProjectSelected(project.name)}
          onChange={() => toggleProjectSelection(project.name)}
          name={project.name}
          color="primary"
        />
      }
      label={project.name}
    />
  );

  if (loadingProjects) {
    // Sized to sit inside the filter panel rather than taking over the column.
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
        <CircularProgress size={20} />
      </Box>
    );
  } else if (projectsError && projects.length === 0) {
    // Only surfaced when there is nothing to show: a failed background refresh
    // over a warm cache must not replace a working panel with an error.
    return <ResponseErrorPanel error={projectsError} />;
  }

  return (
    <>
      <FilterGroup label="Regions">
        {availableRegions.map((region) => (
          <FormControlLabel
            key={region}
            control={
              <Checkbox
                size="small"
                checked={selectedRegions.includes(region)}
                onChange={() => toggleRegionSelection(region)}
                name={region}
                color="primary"
              />
            }
            label={region}
          />
        ))}
      </FilterGroup>
      <FilterGroup label="Projects">
        <TextField
          size="small"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search projects"
          // Deliberately not `type="search"`: Chrome and Safari draw their own
          // clear button for that, which next to the one below made two.
          inputProps={{ 'aria-label': 'Search projects' }}
          sx={{ mb: 0.5, mt: 0.5 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" color="disabled" />
              </InputAdornment>
            ),
            endAdornment: query ? (
              <InputAdornment position="end">
                <IconButton size="small" aria-label="Clear search" onClick={() => setQuery('')}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : undefined,
          }}
        />
        {matches.map(projectCheckbox)}
        {unmatchedPinned.length > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ pt: 0.5 }}>
            Selected, not matching
          </Typography>
        )}
        {unmatchedPinned.map(projectCheckbox)}
        {/* Both messages are announced: the list they describe updates as the
            query is typed, with no other cue that anything changed. */}
        {matches.length + unmatchedPinned.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 0.5 }} role="status">
            {searching
              ? `No projects match “${query.trim()}”.`
              : // Nothing typed, so nothing is filtered — an empty list here is a
                // tenant with no projects, not a search that missed.
                'No projects available.'}
          </Typography>
        )}
        {hiddenCount > 0 && matches.length + unmatchedPinned.length > 0 && (
          // Otherwise a filtered list looks like the whole list.
          <Typography variant="caption" color="text.secondary" sx={{ pt: 0.5 }} role="status">
            {hiddenCount} hidden by search
          </Typography>
        )}
      </FilterGroup>
    </>
  );
};

export default EnvFilterPanel;
