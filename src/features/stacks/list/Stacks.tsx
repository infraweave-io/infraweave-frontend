import React, { useMemo } from 'react';
import { Progress, ResponseErrorPanel } from '../../../standalone/components/ComponentAdapter';
import { usePaginatedItems } from '../../../hooks/usePaginatedItems';
import { Module } from '../../../types/Module';
import { ResourceList } from '../../../shared/components/ResourceList';
import { LoadingMore } from '../../../shared/components/LoadingMore';
import { ListIncomplete } from '../../../shared/components/ListIncomplete';
import { ModuleVersions } from '../../modules/detail/ModuleVersions';
import { readCachedNames } from '../../../utils/resourceNameCache';
import { useSelectedProviders } from '../../root/RootPage/SelectedProvidersContext';

export const Stacks = () => {
  const { selectedProviders } = useSelectedProviders();
  const noCloudSelected = selectedProviders.length === 0;
  // No cloud selected means nothing to show, so skip the request entirely
  // rather than fetching a list we are about to discard.
  const { items, loading, truncated, error } = usePaginatedItems<Module>(
    noCloudSelected
      ? null
      : 'api/proxy/api/infraweave/api/v1/stacks?fields=module,module_name,track,version',
    'stacks',
  );

  // With remembered names the table can be drawn straight away, so a blank
  // spinner would only delay it.
  const hasCachedNames = useMemo(() => readCachedNames('stack').length > 0, []);

  // Only take over the whole view when there is nothing to show. A failure on a
  // later page keeps the pages already loaded, with the error beside them.
  if (error && items.length === 0) {
    return <ResponseErrorPanel error={error} />;
  } else if (loading && items.length === 0 && !hasCachedNames) {
    // Only for a cold start with nothing remembered. Once there are rows on
    // screen the list keeps filling in behind the inline indicator.
    return <Progress />;
  }

  return (
    <>
      <ResourceList
        items={items}
        loading={loading}
        truncated={truncated}
        error={error}
        requestSkipped={noCloudSelected}
        resourceType="stack"
        emptyContent={noCloudSelected ? 'Select a cloud to browse stacks.' : 'No stacks found.'}
        VersionsComponent={ModuleVersions}
      />
      {loading && <LoadingMore />}
      {truncated && <ListIncomplete label="stacks" />}
      {error && <ResponseErrorPanel error={error} />}
    </>
  );
};
