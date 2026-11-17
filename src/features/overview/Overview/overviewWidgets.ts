import { PlacedWidget, WidgetDefinition } from '../../widgets/WidgetContainer';
import { FailedDeploymentsList } from '../../widgets/failed-deployments/failed-deployment';
import { DeploymentHealthSummary } from '../../widgets/deployment-health/deployment-health';
import { TopModulesChart } from '../../widgets/module-usage/module-usage';
import { ModuleIssuesChart } from '../../widgets/module-issues/module-issues';
import { LatestReleasesList } from '../../widgets/latest-releases/latest-releases';
import { RecentlyVisitedList } from '../../widgets/recently-visited/recently-visited';
import { AboutInfraWeave } from '../../widgets/about-infraweave/about-infraweave';
import {
  LatestAppliesList,
  LatestDestroysList,
  LatestPlansList,
} from '../../widgets/deployment-activity/deployment-activity';
import { usageHref } from '../../adoption-health/AdoptionHealthPage/usageContext';

export const OVERVIEW_WIDGETS: WidgetDefinition[] = [
  {
    id: 'failed-deployments',
    title: 'Failed deployments',
    links: [{ to: '/infraweave/deployments', label: 'View all' }],
    Component: FailedDeploymentsList,
  },
  {
    id: 'deployment-health',
    title: 'Deployment health',
    links: [{ to: '/infraweave/adoption-health/health', label: 'Details' }],
    Component: DeploymentHealthSummary,
  },
  { id: 'recently-visited', title: 'Recently visited', Component: RecentlyVisitedList },
  {
    id: 'module-usage',
    title: 'Most deployed modules',
    links: [{ to: usageHref('module-usage', {}), label: 'Details' }],
    Component: TopModulesChart,
  },
  {
    id: 'module-issues',
    title: 'Most failing modules',
    links: [{ to: '/infraweave/adoption-health/issues', label: 'Details' }],
    Component: ModuleIssuesChart,
  },
  {
    id: 'latest-releases',
    title: 'Latest releases',
    links: [
      { to: '/infraweave/modules', label: 'Modules' },
      { to: '/infraweave/stacks', label: 'Stacks' },
    ],
    Component: LatestReleasesList,
  },
  {
    id: 'latest-applies',
    title: 'Latest applies',
    links: [{ to: '/infraweave/deployments', label: 'View all' }],
    Component: LatestAppliesList,
  },
  {
    id: 'latest-plans',
    title: 'Latest plans',
    links: [{ to: '/infraweave/deployments', label: 'View all' }],
    Component: LatestPlansList,
  },
  {
    id: 'latest-destroys',
    title: 'Latest destroys',
    links: [{ to: '/infraweave/deployments', label: 'View all' }],
    Component: LatestDestroysList,
  },
  { id: 'about-infraweave', title: 'About InfraWeave', Component: AboutInfraWeave },
];

/**
 * Left out of the default layout: these ask every account and region for its full history,
 * which only users who want them should pay for. They can be added with Customize.
 */
const OPT_IN_WIDGETS = ['latest-plans', 'latest-destroys'];

/** What a user sees until they customize the page: one column each. */
export const DEFAULT_OVERVIEW_LAYOUT: PlacedWidget[] = OVERVIEW_WIDGETS.filter(
  (widget) => !OPT_IN_WIDGETS.includes(widget.id),
).map((widget) => ({ id: widget.id, size: 'small' }));
