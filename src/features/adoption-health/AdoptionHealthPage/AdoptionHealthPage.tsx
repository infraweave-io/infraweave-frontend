import React from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AdoptionHealthDashboard } from './AdoptionHealthDashboard';
import { BreakdownView } from './BreakdownView';
import { DeploymentHealthView } from './DeploymentHealthView';
import { ModuleIssuesView } from './ModuleIssuesView';
import type { UsageKind } from './usageContext';
import { UsageView } from './UsageView';
import { VelocityView } from './VelocityView';

const ADOPTION_HEALTH_PATH = '/infraweave/adoption-health';
export const AdoptionHealthPage = () => {
  const { view } = useParams<{ view: string }>();
  const { search, hash } = useLocation();
  const navigate = useNavigate();
  const subView = view || 'dashboard';

  const handleNavigate = (targetView: string) => {
    navigate(
      targetView === 'dashboard' ? ADOPTION_HEALTH_PATH : `${ADOPTION_HEALTH_PATH}/${targetView}`,
    );
  };
  const handleBack = () => handleNavigate('dashboard');

  if (subView === 'usage') {
    return (
      <Navigate to={{ pathname: `${ADOPTION_HEALTH_PATH}/module-usage`, search, hash }} replace />
    );
  }

  switch (subView) {
    case 'module-usage':
    case 'stack-usage': {
      const kind: UsageKind = subView === 'stack-usage' ? 'stack' : 'module';
      return <UsageView key={kind} kind={kind} onBack={handleBack} />;
    }
    case 'region-usage':
    case 'account-usage': {
      const by = subView === 'region-usage' ? 'region' : 'account';
      return <BreakdownView key={by} by={by} onBack={handleBack} />;
    }
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
