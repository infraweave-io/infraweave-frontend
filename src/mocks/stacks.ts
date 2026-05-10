export const stacks = [
  {
    PK: 'LATEST_STACK',
    SK: 'MODULE#dev::bucketcollection',
    description:
      "This is a deployment stack consisting of a two S3-buckets and are for testing dependencies between modules.\n\n## Details\nThe first bucket is called bucket1a, you can set the name of it in the variables.\n\nThe second S3 bucket has a name that depends on bucket1a, and will add '-after' appended at the end.\nIt will also add a tag with the ARN of the first bucket as a value.\n",
    manifest: {
      apiVersion: 'infraweave.io/v1',
      kind: 'Stack',
      metadata: {
        name: 'bucketcollection',
      },
      spec: {
        description:
          "This is a deployment stack consisting of a two S3-buckets and are for testing dependencies between modules.\n\n## Details\nThe first bucket is called bucket1a, you can set the name of it in the variables.\n\nThe second S3 bucket has a name that depends on bucket1a, and will add '-after' appended at the end.\nIt will also add a tag with the ARN of the first bucket as a value.\n",
        examples: [
          {
            description:
              "# Minimal example\n\nThis is a deployment stack consisting of a two S3-buckets.\n\nThese are for testing dependencies between modules.\nYou will see that bucket2 will get its name based on the name of bucket1a, with appended '-after' at the end.\n\n### bucket1a\nThis module creates an S3 bucket.\n\n### bucket2\nThis module creates an S3 bucket that depends on bucket1a.\n\nIt also shows how to use tags with dependencies.\n",
            name: 'bucketcollection',
            variables: {
              bucket1a: {
                bucketName: 'bucket1a',
              },
              bucket2: {
                tags: {
                  AnotherTag: 'ARN of dependency bucket {{ S3Bucket::bucket1a::bucketArn }}',
                  SomeTag: 'SomeValue',
                },
              },
            },
          },
        ],
        moduleName: 'BucketCollection',
        reference: 'https://github.com/infreweave-io/stacks/bucketcollection',
        version: '0.0.15-dev+main.9',
      },
    },
    module: 'bucketcollection',
    module_name: 'BucketCollection',
    module_type: 'stack',
    reference: 'https://github.com/infreweave-io/stacks/bucketcollection',
    s3_key: 'bucketcollection/bucketcollection-0.0.15-dev+main.9.zip',
    stack_data: {
      modules: [
        {
          module: 's3bucket',
          s3_key: 's3bucket/s3bucket-0.0.36-dev+test.6.zip',
          version: '0.0.36-dev+test.6',
        },
        {
          module: 's3bucket',
          s3_key: 's3bucket/s3bucket-0.0.36-dev+test.6.zip',
          version: '0.0.36-dev+test.6',
        },
      ],
    },
    tf_required_providers: [
      {
        source: 'hashicorp/aws',
        version: '~> 5.0',
      },
    ],
    tf_lock_providers: [
      {
        source: 'hashicorp/aws',
        version: '5.31.0',
      },
    ],
    tf_outputs: [
      {
        description: '',
        name: 'bucket1a__bucket_arn',
        value: '',
      },
      {
        description: '',
        name: 'bucket1a__region',
        value: '',
      },
      {
        description: '',
        name: 'bucket1a__sse_algorithm',
        value: '',
      },
      {
        description: '',
        name: 'bucket1a__tags',
        value: '',
      },
      {
        description: '',
        name: 'bucket2__bucket_arn',
        value: '',
      },
      {
        description: '',
        name: 'bucket2__region',
        value: '',
      },
      {
        description: '',
        name: 'bucket2__sse_algorithm',
        value: '',
      },
      {
        description: '',
        name: 'bucket2__tags',
        value: '',
      },
    ],
    tf_variables: [
      {
        default: null,
        description:
          'Name of the S3 bucket. This must be globally unique and can contain only lowercase letters, numbers, hyphens, and periods. It must be between 3 and 63 characters long.',
        name: 'bucket1a__bucket_name',
        nullable: false,
        sensitive: false,
        type: 'string',
      },
      {
        default: false,
        description:
          'Enable ACL for the S3 bucket. If set to true, the bucket will be created with a bucket policy that grants full control to the AWS account owner.',
        name: 'bucket1a__enable_acl',
        nullable: true,
        sensitive: false,
        type: 'bool',
      },
      {
        default: {
          Environment43: 'dev',
          Name234: 'my-s3bucket-bucket1a',
        },
        description: '',
        name: 'bucket1a__tags',
        nullable: true,
        sensitive: false,
        type: 'map(string)',
      },
      {
        default: false,
        description:
          'Enable ACL for the S3 bucket. If set to true, the bucket will be created with a bucket policy that grants full control to the AWS account owner.',
        name: 'bucket2__enable_acl',
        nullable: true,
        sensitive: false,
        type: 'bool',
      },
    ],
    timestamp: '2024-11-10T19:57:06.105Z',
    track: 'dev',
    track_version: 'dev#000.000.015-dev+main.9',
    version: '0.0.15-dev+main.9',
    version_diff: null,
  },
  {
    PK: 'LATEST_STACK',
    SK: 'MODULE#dev::websiterunner',
    description:
      "This is a deployment stack consisting of a two S3-buckets and are for testing dependencies between modules.\n\n## Details\nThe first bucket is called bucket1a, you can set the name of it in the variables.\n\nThe second S3 bucket has a name that depends on bucket1a, and will add '-after' appended at the end.\nIt will also add a tag with the ARN of the first bucket as a value.\n",
    manifest: {
      apiVersion: 'infraweave.io/v1',
      kind: 'Stack',
      metadata: {
        name: 'websiterunner',
      },
      spec: {
        description:
          "This is a deployment stack consisting of a two S3-buckets and are for testing dependencies between modules.\n\n## Details\nThe first bucket is called bucket1a, you can set the name of it in the variables.\n\nThe second S3 bucket has a name that depends on bucket1a, and will add '-after' appended at the end.\nIt will also add a tag with the ARN of the first bucket as a value.\n",
        examples: [
          {
            description:
              '# Minimal example\n\nThis is a deployment that sets up a website runner.\n\nIt consists of an S3 bucket and an EC2 instance + VPC.\n',
            name: 'Simple Website Runner',
            variables: {
              runnerbucket: {
                bucketName: 'dev-tesnjk321',
                tags: {
                  Environment43: 'testtest3',
                  Name234: 'my-s3bucket22',
                },
              },
              runnervpc: {
                name: 'test',
              },
            },
          },
        ],
        moduleName: 'WebsiteRunner',
        reference: 'https://gitlab.com/infraweave/stacks/website_runner',
        version: '0.0.15-dev+main.6',
      },
    },
    module: 'websiterunner',
    module_name: 'WebsiteRunner',
    module_type: 'stack',
    reference: 'https://gitlab.com/infraweave/stacks/website_runner',
    s3_key: 'websiterunner/websiterunner-0.0.15-dev+main.6.zip',
    stack_data: {
      modules: [
        {
          module: 'ec2',
          s3_key: 'ec2/ec2-0.0.5-dev+main.1.zip',
          version: '0.0.5-dev+main.1',
        },
        {
          module: 'vpc',
          s3_key: 'vpc/vpc-0.0.2-dev+add-output-subnet-a.33.zip',
          version: '0.0.2-dev+add-output-subnet-a.33',
        },
        {
          module: 's3bucket',
          s3_key: 's3bucket/s3bucket-0.0.36-dev+test.6.zip',
          version: '0.0.36-dev+test.6',
        },
      ],
    },
    tf_required_providers: [
      {
        source: 'hashicorp/aws',
        version: '~> 5.0',
      },
    ],
    tf_lock_providers: [
      {
        source: 'hashicorp/aws',
        version: '5.31.0',
      },
    ],
    tf_outputs: [
      {
        description: '',
        name: 'runnerbucket__bucket_arn',
        value: '',
      },
      {
        description: '',
        name: 'runnerbucket__region',
        value: '',
      },
      {
        description: '',
        name: 'runnerbucket__sse_algorithm',
        value: '',
      },
      {
        description: '',
        name: 'runnerbucket__tags',
        value: '',
      },
      {
        description: '',
        name: 'runnerec2__instance_id',
        value: '',
      },
      {
        description: '',
        name: 'runnerec2__private_ip',
        value: '',
      },
      {
        description: '',
        name: 'runnerec2__public_ip',
        value: '',
      },
      {
        description: '',
        name: 'runnervpc__private_subnets',
        value: '',
      },
      {
        description: '',
        name: 'runnervpc__public_subnet_a',
        value: '',
      },
      {
        description: '',
        name: 'runnervpc__public_subnets',
        value: '',
      },
      {
        description: '',
        name: 'runnervpc__vpc_id',
        value: '',
      },
    ],
    tf_variables: [
      {
        default: null,
        description:
          'Name of the S3 bucket. This must be globally unique and can contain only lowercase letters, numbers, hyphens, and periods. It must be between 3 and 63 characters long.',
        name: 'runnerbucket__bucket_name',
        nullable: true,
        sensitive: false,
        type: 'string',
      },
      {
        default: false,
        description:
          'Enable ACL for the S3 bucket. If set to true, the bucket will be created with a bucket policy that grants full control to the AWS account owner.',
        name: 'runnerbucket__enable_acl',
        nullable: true,
        sensitive: false,
        type: 'bool',
      },
      {
        default: {
          Environment43: 'dev',
          Name234: 'my-s3bucket-bucket1a',
        },
        description: '',
        name: 'runnerbucket__tags',
        nullable: true,
        sensitive: false,
        type: 'map(string)',
      },
      {
        default: '',
        description:
          'The Amazon Machine Image (AMI) ID to use for the instance. Leave empty to use the latest Amazon Linux 2 AMI.',
        name: 'runnerec2__ami_id',
        nullable: true,
        sensitive: false,
        type: 'string',
      },
      {
        default: 'MinimalEC2Instance',
        description: 'The name tag for the instance.',
        name: 'runnerec2__instance_name',
        nullable: true,
        sensitive: false,
        type: 'string',
      },
      {
        default: 't2.micro',
        description: 'The type of instance to create (e.g., t2.micro, t3.small).',
        name: 'runnerec2__instance_type',
        nullable: true,
        sensitive: false,
        type: 'string',
      },
      {
        default: null,
        description:
          'The name of the SSH key pair to use for the instance. This key must be created in AWS before deploying.',
        name: 'runnerec2__key_name',
        nullable: true,
        sensitive: false,
        type: 'string',
      },
      {
        default: null,
        description: 'The ID of the subnet in which to launch the instance.',
        name: 'runnerec2__subnet_id',
        nullable: true,
        sensitive: false,
        type: 'string',
      },
      {
        default: null,
        description: '',
        name: 'runnervpc__name',
        nullable: true,
        sensitive: false,
        type: 'string',
      },
      {
        default: 2,
        description: '',
        name: 'runnervpc__private_subnet_count',
        nullable: true,
        sensitive: false,
        type: 'number',
      },
      {
        default: 2,
        description: '',
        name: 'runnervpc__public_subnet_count',
        nullable: true,
        sensitive: false,
        type: 'number',
      },
      {
        default: '10.0.0.0/16',
        description: '',
        name: 'runnervpc__vpc_cidr',
        nullable: true,
        sensitive: false,
        type: 'string',
      },
    ],
    timestamp: '2024-11-13T21:33:06.345Z',
    track: 'dev',
    track_version: 'dev#000.000.015-dev+main.6',
    version: '0.0.15-dev+main.6',
    version_diff: null,
  },
];
