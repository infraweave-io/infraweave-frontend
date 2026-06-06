import React from 'react';
import { useConfig } from '../../../hooks/useConfig';
import { Progress, ResponseErrorPanel } from '../../../standalone/components/ComponentAdapter';
import { useAsync } from '../../../hooks/useAsync';
import { Module } from '../../../types/Module';
import { ResourceList } from '../../../shared/components/ResourceList';
import { ModuleVersions } from '../detail/ModuleVersions';

export const Modules = () => {
  const config = useConfig();
  const { value, loading, error } = useAsync(async (): Promise<Module[]> => {
    const url = config.getApiUrl(
      'api/proxy/api/infraweave/api/v1/modules?fields=module,module_name,track,version',
    );
    const response = await config.fetch(url);
    if (response.status >= 300 && response.status < 400) {
      throw new Error('Redirected to login or guest page');
    }
    if (!response.ok) throw new Error('Failed to fetch modules');

    const json = await response.json();
    return json.Items || json.items || json;
  }, []);

  if (loading) {
    return <Progress />;
  } else if (error) {
    return <ResponseErrorPanel error={error} />;
  }

  return (
    <ResourceList
      items={value || []}
      resourceType="module"
      title="Modules List"
      VersionsComponent={ModuleVersions}
    />
  );
};
