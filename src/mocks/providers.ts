export const providers = [
  {
    name: 'aws-5',
    version: '0.0.2',
    track: 'stable',
    description:
      'AWS Provider with default configuration. This provider is configured to use the default AWS profile and region.',
    reference: 'https://github.com/infreweave-io/providers/aws-5',
    timestamp: '2025-11-18T12:08:15.541Z',
    s3_key: 'providers/aws-5/0.0.2.zip',
    tf_required_providers: [
      {
        source: 'hashicorp/aws',
        version: '~> 5.0',
      },
    ],
    tf_lock_providers: [
      {
        source: 'registry.terraform.io/hashicorp/aws',
        version: '5.30.0',
      },
    ],
  },
];
