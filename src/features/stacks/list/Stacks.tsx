import React from 'react';
import { Progress, ResponseErrorPanel } from '../../../standalone/components/ComponentAdapter';
import { usePaginatedItems } from '../../../hooks/usePaginatedItems';
import { Module } from '../../../types/Module';
import { ResourceList } from '../../../shared/components/ResourceList';
import { LoadingMore } from '../../../shared/components/LoadingMore';
import { ListIncomplete } from '../../../shared/components/ListIncomplete';
import { ModuleVersions } from '../../modules/detail/ModuleVersions';

export const Stacks = () => {
  const { items, loading, truncated, error } = usePaginatedItems<Module>(
    'api/proxy/api/infraweave/api/v1/stacks?fields=module,module_name,track,version',
    'stacks',
  );

  // Only take over the whole view when there is nothing to show. A failure on a
  // later page keeps the pages already loaded, with the error beside them.
  if (error && items.length === 0) {
    return <ResponseErrorPanel error={error} />;
  } else if (loading && items.length === 0) {
    // Only for a cold start. Once the first page is on screen the list keeps
    // filling in behind the inline indicator instead of blanking out again.
    return <Progress />;
  }

  return (
    <>
      <ResourceList items={items} resourceType="stack" VersionsComponent={ModuleVersions} />
      {loading && <LoadingMore />}
      {truncated && <ListIncomplete label="stacks" />}
      {error && <ResponseErrorPanel error={error} />}
    </>
  );
};
