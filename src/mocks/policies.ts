export const policies = [
  {
    PK: 'POLICY#aws::allowed-regions',
    SK: 'VERSION#000.001.002',
    data: {
      allowed_regions: ['us-east-1', 'eu-west-1', 'eu-central-1'],
    },
    description:
      "# Allowed Regions\nThere are a set of regions that are allowed to be used, since these are the regions that the company has a presence in.\n\n## Best practices\n- Use the allowed regions to ensure that the company's data is stored in the regions where the company has a presence.\n\n## Questions\nIf you need to use a region that is not in the list, please [reach out](mailto:security@acmecorp.com) to the security team\n",
    environment: 'aws',
    environment_version: 'aws#000.001.002',
    manifest: {
      apiVersion: 'infrabridge.io/v1',
      kind: 'Policy',
      metadata: {
        name: 'allowed-regions',
      },
      spec: {
        data: {
          allowed_regions: ['us-east-1', 'eu-west-1', 'eu-central-1'],
        },
        description:
          "# Allowed Regions\nThere are a set of regions that are allowed to be used, since these are the regions that the company has a presence in.\n\n## Best practices\n- Use the allowed regions to ensure that the company's data is stored in the regions where the company has a presence.\n\n## Questions\nIf you need to use a region that is not in the list, please [reach out](mailto:security@acmecorp.com) to the security team\n",
        policyName: 'AllowedRegions',
        reference: 'https://github.com/infreweave-io/policies/aws/allowed_regions',
        version: '0.1.2',
      },
    },
    policy: 'allowed-regions',
    policy_name: 'AllowedRegions',
    reference: 'https://github.com/infreweave-io/policies/aws/allowed_regions',
    s3_key: 'allowed-regions/allowed-regions-0.1.2.zip',
    timestamp: '2024-11-06T19:54:50.558Z',
    version: '0.1.2',
  },
  {
    PK: 'POLICY#aws::s3-naming-format',
    SK: 'VERSION#000.000.003',
    data: {
      allowed_prefixes: ['dev-', 'prod-'],
    },
    description:
      '# Allowed Naming Formats\nChecks if the S3 bucket name follows the naming convention.\nIt should start with dev- or prod-\n\n## Reasons\n- To maintain consistency in naming\n- To easily identify the environment\n\n## Best practices\n- Use a prefix to identify the environment\n',
    environment: 'aws',
    environment_version: 'aws#000.000.003',
    manifest: {
      apiVersion: 'infrabridge.io/v1',
      kind: 'Policy',
      metadata: {
        name: 's3-naming-format',
      },
      spec: {
        data: {
          allowed_prefixes: ['dev-', 'prod-'],
        },
        description:
          '# Allowed Naming Formats\nChecks if the S3 bucket name follows the naming convention.\nIt should start with dev- or prod-\n\n## Reasons\n- To maintain consistency in naming\n- To easily identify the environment\n\n## Best practices\n- Use a prefix to identify the environment\n',
        policyName: 'NamingFormat',
        reference: 'https://github.com/infreweave-io/policies/aws/naming_format',
        version: '0.0.3',
      },
    },
    policy: 's3-naming-format',
    policy_name: 'NamingFormat',
    reference: 'https://github.com/infreweave-io/policies/aws/naming_format',
    s3_key: 's3-naming-format/s3-naming-format-0.0.3.zip',
    timestamp: '2024-11-06T18:51:51.792Z',
    version: '0.0.3',
  },
];
