import { Deployment } from '../types/Deployment';

/** A deployment id is only unique within its account, region and environment. */
export const deploymentKey = (d: Deployment) =>
  `${d.project_id}/${d.region}/${d.environment}/${d.deployment_id}`;

export const deploymentLink = (d: Deployment) =>
  `/infraweave/deployment/${d.project_id}/${d.region}/${encodeURIComponent(
    d.environment,
  )}/${encodeURIComponent(d.deployment_id)}/overview`;
