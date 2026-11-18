import { Deployment } from '../types/Deployment';
import { deploymentKey, deploymentLink } from './deploymentLink';

const deployment = {
  project_id: '123456789012',
  region: 'eu-west-1',
  environment: 'playground/dev',
  deployment_id: 's3bucket/my-bucket',
} as Deployment;

describe('deploymentKey', () => {
  it('tells apart deployments that share an id in different places', () => {
    expect(deploymentKey(deployment)).not.toBe(
      deploymentKey({ ...deployment, region: 'us-east-1' }),
    );
  });
});

describe('deploymentLink', () => {
  it('encodes the environment and id so each stays one path segment', () => {
    expect(deploymentLink(deployment)).toBe(
      '/infraweave/deployment/123456789012/eu-west-1/playground%2Fdev/s3bucket%2Fmy-bucket/overview',
    );
  });

  it('encodes the account and region too, so no segment can be added or changed', () => {
    expect(deploymentLink({ ...deployment, project_id: '../admin', region: 'a/b' })).toBe(
      '/infraweave/deployment/..%2Fadmin/a%2Fb/playground%2Fdev/s3bucket%2Fmy-bucket/overview',
    );
  });
});
