import type { Deployment } from '../../../types/Deployment';

/** A deployment id is only unique within its account, region and environment. */
export const deploymentKey = (deployment: Deployment) =>
  `${deployment.project_id}/${deployment.region}/${deployment.environment}/${deployment.deployment_id}`;

export const deploymentLink = (deployment: Deployment) =>
  `/infraweave/deployment/${deployment.project_id}/${deployment.region}/${encodeURIComponent(
    deployment.environment,
  )}/${encodeURIComponent(deployment.deployment_id)}/overview`;
