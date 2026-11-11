import React, { useState } from 'react';
import { useConfig } from '../../hooks/useConfig';
import { useIsStandalone } from '../../contexts/ConfigContext';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Button } from '@mui/material';
import {
  Progress,
  ResponseErrorPanel,
  Header,
  Page,
  HeaderLabel,
  HeaderTabs,
} from '../../standalone/components/ComponentAdapter';
import { Module } from '../../types/Module';
import { Navigate, useParams, useNavigate } from 'react-router-dom';
import { useAsync } from '../../hooks/useAsync';

export interface ResourcePageProps {
  resourceType: 'module' | 'stack';
  renderTabContent: (value: Module | undefined, selectedTab: number, props: any) => React.ReactNode;
  tabs?: Array<{ label: string }>;
  additionalProps?: any;
  headerActions?: React.ReactNode | ((value: Module | undefined) => React.ReactNode);
  hideContent?: boolean;
}

type RouteType = ResourcePageProps['resourceType'];

/** True when the record declares a type of its own that differs from the route it was opened under. */
const isWrongRoute = (
  recordType: string | undefined,
  routeType: RouteType,
): recordType is RouteType =>
  (recordType === 'module' || recordType === 'stack') && recordType !== routeType;

const RedirectToRecord = ({
  type,
  track,
  name = '',
  version = '',
}: {
  type: RouteType;
  track?: string;
  name?: string;
  version?: string;
}) => (
  <Navigate
    replace
    to={`/infraweave/${type}/${track}/${encodeURIComponent(name)}/${encodeURIComponent(version)}`}
  />
);

export const ResourcePage: React.FC<ResourcePageProps> = ({
  resourceType,
  renderTabContent,
  tabs = [
    { label: 'Information' },
    { label: 'Examples' },
    { label: 'Versions' },
    { label: 'Usage' },
  ],
  additionalProps = {},
  headerActions,
  hideContent = false,
}) => {
  const navigate = useNavigate();
  const isStandalone = useIsStandalone();

  const { track, moduleName, moduleVersion, stackName, stackVersion } = useParams<{
    track: string;
    moduleName?: string;
    moduleVersion?: string;
    stackName?: string;
    stackVersion?: string;
  }>();

  const resourceName = resourceType === 'module' ? moduleName : stackName;
  const resourceVersionParam = resourceType === 'module' ? moduleVersion : stackVersion;

  const config = useConfig();
  const { value, loading, error } = useAsync(async (): Promise<Module> => {
    const encodedName = encodeURIComponent(resourceName ?? '');
    const encodedVersion = encodeURIComponent(resourceVersionParam ?? '');

    const response = await config.fetch(
      config.getApiUrl(
        `api/proxy/api/infraweave/api/v1/${resourceType}/${track}/${encodedName}/${encodedVersion}`,
      ),
    );

    if (response.status >= 300 && response.status < 400) {
      throw new Error('Redirected to login or guest page');
    }

    if (!response.ok) throw new Error(`Failed to fetch ${resourceType}`);

    const json = await response.json();
    return json;
  }, [resourceType, track, resourceName, resourceVersionParam]);

  const [selectedTab, setSelectedTab] = useState<number>(0);

  const handleTabChange = (index: number) => {
    setSelectedTab(index);
  };

  if (loading) {
    if (hideContent) return null;
    return <Progress />;
  } else if (error) {
    if (hideContent) return null;
    return <ResponseErrorPanel error={error} />;
  }

  // The API serves modules and stacks from the same lookup, so a stack also loads under
  // /module/ and vice versa. Send the viewer to the route that matches the record's type.
  const recordType = value?.module_type;
  if (isWrongRoute(recordType, resourceType)) {
    if (hideContent) return null;
    return (
      <RedirectToRecord
        type={recordType}
        track={track}
        name={resourceName}
        version={resourceVersionParam}
      />
    );
  }

  const displayName = value?.module_name ?? resourceName;
  const actions = typeof headerActions === 'function' ? headerActions(value) : headerActions;

  if (hideContent) {
    return <>{renderTabContent(value, selectedTab, additionalProps)}</>;
  }

  return (
    <Page themeId="tool">
      {!isStandalone && (
        <HeaderTabs
          selectedIndex={selectedTab}
          onChange={handleTabChange}
          tabs={tabs.map(({ label }, index) => ({
            id: index.toString(),
            label,
          }))}
        />
      )}
      {isStandalone ? (
        <Header
          title={displayName}
          subtitle={`${resourceType === 'module' ? 'Module' : 'Stack'} • Version ${value?.version}${
            value?.deprecated ? ' (Deprecated)' : ''
          }`}
        >
          {actions}
        </Header>
      ) : (
        <Header
          title={
            <>
              <Button
                startIcon={<ArrowBackIcon />}
                onClick={() => navigate(`/infraweave/${resourceType}s`)}
                style={{ marginBottom: '8px', color: 'white' }}
              >
                {/* Back */}
              </Button>
              {displayName}
            </>
          }
          subtitle={`${resourceType === 'module' ? 'Module' : 'Stack'} • Version ${value?.version}${
            value?.deprecated ? ' (Deprecated)' : ''
          }`}
        >
          <HeaderLabel label="Owner" value="Team X" />
          <HeaderLabel label="Lifecycle" value="Alpha" />
          {value?.deprecated && <HeaderLabel label="Status" value="Deprecated" />}
          {actions}
        </Header>
      )}
      {renderTabContent(value, selectedTab, { ...additionalProps, resourceType })}
    </Page>
  );
};
