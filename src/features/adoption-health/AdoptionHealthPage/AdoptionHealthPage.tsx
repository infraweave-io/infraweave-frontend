import React from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AdoptionHealthDashboard } from './AdoptionHealthDashboard';
import { BreakdownView } from './BreakdownView';
import { DeploymentHealthView } from './DeploymentHealthView';
import { ModuleIssuesView } from './ModuleIssuesView';
import { UsageView } from './UsageView';
import { ModuleStackUsageExplorerPage } from './ModuleStackUsageExplorerPage';
import { VelocityView } from './VelocityView';

const ADOPTION_HEALTH_PATH = '/infraweave/adoption-health';

export const AdoptionHealthPage = () => {
  const { view } = useParams<{ view: string }>();
  const { search, hash } = useLocation();
  const navigate = useNavigate();

  const handleNavigate = (targetView: string) => {
    navigate(
      targetView === 'dashboard' ? ADOPTION_HEALTH_PATH : `${ADOPTION_HEALTH_PATH}/${targetView}`,
    );
  };
  const handleBack = () => handleNavigate('dashboard');

  switch (view) {
    case 'usage':
      return (
        <Navigate to={{ pathname: `${ADOPTION_HEALTH_PATH}/module-usage`, search, hash }} replace />
      );
    case 'module-usage':
      return <UsageView key="module" kind="module" onBack={handleBack} />;
    case 'stack-usage':
      return <UsageView key="stack" kind="stack" onBack={handleBack} />;
    case 'deployment-explorer':
      return <ModuleStackUsageExplorerPage onBack={handleBack} />;
    case 'region-usage':
      return <BreakdownView key="region" by="region" onBack={handleBack} />;
    case 'account-usage':
      return <BreakdownView key="account" by="account" onBack={handleBack} />;
    case 'velocity':
      return <VelocityView onBack={handleBack} />;
    case 'health':
      return <DeploymentHealthView onBack={handleBack} />;
    case 'issues':
      return <ModuleIssuesView onBack={handleBack} />;
    default:
      return <AdoptionHealthDashboard onNavigate={handleNavigate} />;
  }
};
