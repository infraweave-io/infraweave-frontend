import type { Deployment } from '../../../types/Deployment';

/** A deployment id is only unique within its account, region and environment. */
export const deploymentKey = (deployment: Deployment) =>
  `${deployment.project_id}/${deployment.region}/${deployment.environment}/${deployment.deployment_id}`;

export const deploymentLink = (deployment: Deployment) =>
  `/infraweave/deployment/${deployment.project_id}/${deployment.region}/${encodeURIComponent(
    deployment.environment,
  )}/${encodeURIComponent(deployment.deployment_id)}/overview`;

/** A module without a recorded track is published on the stable track. */
export const moduleVersionLink = (name: string, version: string, track: string) =>
  `/infraweave/module/${encodeURIComponent(track || 'stable')}/${encodeURIComponent(
    name,
  )}/${encodeURIComponent(version)}`;

export const stackVersionLink = (name: string, version: string, track: string) =>
  `/infraweave/stack/${encodeURIComponent(track || 'stable')}/${encodeURIComponent(
    name,
  )}/${encodeURIComponent(version)}`;
