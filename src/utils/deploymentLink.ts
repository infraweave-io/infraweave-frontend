import { Deployment } from '../types/Deployment';

/** A deployment id is only unique within its account, region and environment. */
export const deploymentKey = (d: Deployment) =>
  `${d.project_id}/${d.region}/${d.environment}/${d.deployment_id}`;

/** Every segment is encoded, so a value from the backend can never add or change one. */
export const deploymentLink = (
  d: Pick<Deployment, 'project_id' | 'region' | 'environment' | 'deployment_id'>,
) =>
  `/infraweave/deployment/${[d.project_id, d.region, d.environment, d.deployment_id]
    .map((segment) => encodeURIComponent(segment ?? ''))
    .join('/')}/overview`;
