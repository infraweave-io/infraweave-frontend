export const modules = [
  {
    track: 'dev',
    track_version: 'dev#000.000.036-dev+test.11',
    version: '0.0.36-dev+test.11',
    timestamp: '2024-12-05T21:17:24.895Z',
    module_name: 'S3Bucket',
    module: 's3bucket',
    module_type: 'module',
    description:
      'An S3 bucket is a storage service provided by AWS. It can be used to store files, such as images, videos, and other files. It can also be used to host static websites.\n\nThis module creates an S3 bucket.\n\n## Features\nContains the following features:\n- Set tags\n- Enable versioning\n- Enable server-side encryption\n',
    reference: 'https://github.com/infreweave-io/modules/s3bucket',
    manifest: {
      metadata: {
        name: 's3bucket',
      },
      apiVersion: 'infrabridge.io/v1',
      kind: 'Module',
      spec: {
        moduleName: 'S3Bucket',
        version: '0.0.36-dev+test.11',
        description:
          'An S3 bucket is a storage service provided by AWS. It can be used to store files, such as images, videos, and other files. It can also be used to host static websites.\n\nThis module creates an S3 bucket.\n\n## Features\nContains the following features:\n- Set tags\n- Enable versioning\n- Enable server-side encryption\n',
        reference: 'https://github.com/infreweave-io/modules/s3bucket',
        examples: [
          {
            name: 'simple-bucket',
            description:
              '# Simple Bucket\n\nThis example creates an S3 bucket.\n\n## Description\n\nThis can be used to store files, such as images, videos, and other files.\nIt can also be used to host static websites.\n',
            variables: {
              bucketName: 'mybucket-14923',
            },
          },
          {
            name: 'advanced-bucket',
            description:
              '# Advanced Bucket\n\nThis example creates an S3 bucket with versioning enabled.\n\n## Description\n\nThis can be used to store files, such as images, videos, and other files. It is more advanced than the simple-bucket example.\n\nSome examples of advanced features include:\n- Versioning\n- Tags\n\n## Tags\n\nYou can set tags like this:\n```yaml\ntags:\n  Name: mybucket-14923\n  Environment: dev\n```\n',
            variables: {
              bucketName: 'mybucket-14923',
              tags: {
                Environment: 'dev',
                Name: 'mybucket-14923',
              },
            },
          },
        ],
        cpu: '1024',
        memory: '4096',
      },
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
    tf_variables: [
      {
        name: 'bucket_name',
        type: 'string',
        default: null,
        description:
          'Name of the S3 bucket. This must be globally unique and can contain only lowercase letters, numbers, hyphens, and periods. It must be between 3 and 63 characters long.',
        nullable: true,
        sensitive: false,
      },
      {
        name: 'enable_acl',
        type: 'bool',
        default: false,
        description:
          'Enable ACL for the S3 bucket. If set to true, the bucket will be created with a bucket policy that grants full control to the AWS account owner.',
        nullable: false,
        sensitive: false,
      },
      {
        name: 'tags',
        type: 'map(string)',
        default: {
          Test: 'override-me',
        },
        description: '',
        nullable: true,
        sensitive: false,
      },
    ],
    tf_outputs: [
      {
        name: 'bucket_arn',
        value: '',
        description: '',
      },
      {
        name: 'region',
        value: '',
        description: '',
      },
      {
        name: 'sse_algorithm',
        value: '',
        description: '',
      },
      {
        name: 'tags',
        value: '',
        description: '',
      },
    ],
    s3_key: 's3bucket/s3bucket-0.0.36-dev+test.11.zip',
    stack_data: null,
    version_diff: {
      added: [],
      changed: [],
      removed: [],
      previous_version: '0.0.36-dev+test.10',
    },
    cpu: '1024',
    memory: '4096',
  },
  {
    track: 'beta',
    track_version: 'beta#000.000.036-beta+test.3',
    version: '0.0.36-beta+test.3',
    timestamp: '2024-12-05T21:17:24.895Z',
    module_name: 'S3Bucket',
    module: 's3bucket',
    module_type: 'module',
    description:
      'An S3 bucket is a storage service provided by AWS. It can be used to store files, such as images, videos, and other files. It can also be used to host static websites.\n\nThis module creates an S3 bucket.\n\n## Features\nContains the following features:\n- Set tags\n- Enable versioning\n- Enable server-side encryption\n',
    reference: 'https://github.com/infreweave-io/modules/s3bucket',
    manifest: {
      metadata: {
        name: 's3bucket',
      },
      apiVersion: 'infrabridge.io/v1',
      kind: 'Module',
      spec: {
        moduleName: 'S3Bucket',
        version: '0.0.36-beta+test.3',
        description:
          'An S3 bucket is a storage service provided by AWS. It can be used to store files, such as images, videos, and other files. It can also be used to host static websites.\n\nThis module creates an S3 bucket.\n\n## Features\nContains the following features:\n- Set tags\n- Enable versioning\n- Enable server-side encryption\n',
        reference: 'https://github.com/infreweave-io/modules/s3bucket',
        examples: [
          {
            name: 'simple-bucket',
            description:
              '# Simple Bucket\n\nThis example creates an S3 bucket.\n\n## Description\n\nThis can be used to store files, such as images, videos, and other files.\nIt can also be used to host static websites.\n',
            variables: {
              bucketName: 'mybucket-14923',
            },
          },
          {
            name: 'advanced-bucket',
            description:
              '# Advanced Bucket\n\nThis example creates an S3 bucket with versioning enabled.\n\n## Description\n\nThis can be used to store files, such as images, videos, and other files. It is more advanced than the simple-bucket example.\n\nSome examples of advanced features include:\n- Versioning\n- Tags\n\n## Tags\n\nYou can set tags like this:\n```yaml\ntags:\n  Name: mybucket-14923\n  Environment: dev\n```\n',
            variables: {
              bucketName: 'mybucket-14923',
              tags: {
                Environment: 'dev',
                Name: 'mybucket-14923',
              },
            },
          },
        ],
        cpu: '1024',
        memory: '4096',
      },
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
    tf_variables: [
      {
        name: 'bucket_name',
        type: 'string',
        default: null,
        description:
          'Name of the S3 bucket. This must be globally unique and can contain only lowercase letters, numbers, hyphens, and periods. It must be between 3 and 63 characters long.',
        nullable: true,
        sensitive: false,
      },
      {
        name: 'enable_acl',
        type: 'bool',
        default: false,
        description:
          'Enable ACL for the S3 bucket. If set to true, the bucket will be created with a bucket policy that grants full control to the AWS account owner.',
        nullable: false,
        sensitive: false,
      },
      {
        name: 'tags',
        type: 'map(string)',
        default: {
          Test: 'override-me',
        },
        description: '',
        nullable: true,
        sensitive: false,
      },
    ],
    tf_outputs: [
      {
        name: 'bucket_arn',
        value: '',
        description: '',
      },
      {
        name: 'region',
        value: '',
        description: '',
      },
      {
        name: 'sse_algorithm',
        value: '',
        description: '',
      },
      {
        name: 'tags',
        value: '',
        description: '',
      },
    ],
    s3_key: 's3bucket/s3bucket-0.0.36-beta+test.3.zip',
    stack_data: null,
    version_diff: {
      added: [],
      changed: [],
      removed: [],
      previous_version: '0.0.36-beta+test.10',
    },
    cpu: '1024',
    memory: '4096',
  },
  {
    track: 'dev',
    track_version: 'beta#000.000.02-dev+some_branch.5',
    version: '0.0.2-dev+some_branch.5',
    timestamp: '2024-12-05T21:17:24.895Z',
    module_name: 'EC2',
    module: 'ec2',
    module_type: 'module',
    description:
      'An S3 bucket is a storage service provided by AWS. It can be used to store files, such as images, videos, and other files. It can also be used to host static websites.\n\nThis module creates an S3 bucket.\n\n## Features\nContains the following features:\n- Set tags\n- Enable versioning\n- Enable server-side encryption\n',
    reference: 'https://github.com/infreweave-io/modules/ec2',
    manifest: {
      metadata: {
        name: 'ec2',
      },
      apiVersion: 'infrabridge.io/v1',
      kind: 'Module',
      spec: {
        moduleName: 'ec2',
        version: '0.0.2-dev+some_branch.5',
        description:
          'An S3 bucket is a storage service provided by AWS. It can be used to store files, such as images, videos, and other files. It can also be used to host static websites.\n\nThis module creates an S3 bucket.\n\n## Features\nContains the following features:\n- Set tags\n- Enable versioning\n- Enable server-side encryption\n',
        reference: 'https://github.com/infreweave-io/modules/ec2',
        examples: [
          {
            name: 'simple-bucket',
            description:
              '# Simple Bucket\n\nThis example creates an S3 bucket.\n\n## Description\n\nThis can be used to store files, such as images, videos, and other files.\nIt can also be used to host static websites.\n',
            variables: {
              bucketName: 'mybucket-14923',
            },
          },
          {
            name: 'advanced-bucket',
            description:
              '# Advanced Bucket\n\nThis example creates an S3 bucket with versioning enabled.\n\n## Description\n\nThis can be used to store files, such as images, videos, and other files. It is more advanced than the simple-bucket example.\n\nSome examples of advanced features include:\n- Versioning\n- Tags\n\n## Tags\n\nYou can set tags like this:\n```yaml\ntags:\n  Name: mybucket-14923\n  Environment: dev\n```\n',
            variables: {
              bucketName: 'mybucket-14923',
              tags: {
                Environment: 'dev',
                Name: 'mybucket-14923',
              },
            },
          },
        ],
        cpu: '1024',
        memory: '4096',
      },
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
    tf_variables: [
      {
        name: 'bucket_name',
        type: 'string',
        default: null,
        description:
          'Name of the S3 bucket. This must be globally unique and can contain only lowercase letters, numbers, hyphens, and periods. It must be between 3 and 63 characters long.',
        nullable: true,
        sensitive: false,
      },
      {
        name: 'enable_acl',
        type: 'bool',
        default: false,
        description:
          'Enable ACL for the S3 bucket. If set to true, the bucket will be created with a bucket policy that grants full control to the AWS account owner.',
        nullable: false,
        sensitive: false,
      },
      {
        name: 'tags',
        type: 'map(string)',
        default: {
          Test: 'override-me',
        },
        description: '',
        nullable: true,
        sensitive: false,
      },
    ],
    tf_outputs: [
      {
        name: 'bucket_arn',
        value: '',
        description: '',
      },
      {
        name: 'region',
        value: '',
        description: '',
      },
      {
        name: 'sse_algorithm',
        value: '',
        description: '',
      },
      {
        name: 'tags',
        value: '',
        description: '',
      },
    ],
    s3_key: 'ec2/ec2-0.0.2-dev+some_branch.5.zip',
    stack_data: null,
    version_diff: {
      added: [],
      changed: [],
      removed: [],
      previous_version: '0.0.36-beta+test.10',
    },
    cpu: '1024',
    memory: '4096',
  },
  {
    track: 'dev',
    track_version: 'dev#000.000.036-dev+test.12',
    version: '0.0.36-dev+test.12',
    timestamp: '2024-12-05T21:17:24.895Z',
    module_name: 'S3Bucket',
    module: 's3bucket',
    module_type: 'module',
    description:
      'An S3 bucket is a storage service provided by AWS. It can be used to store files, such as images, videos, and other files. It can also be used to host static websites.\n\nThis module creates an S3 bucket.\n\n## Features\nContains the following features:\n- Set tags\n- Enable versioning\n- Enable server-side encryption\n',
    reference: 'https://github.com/infreweave-io/modules/s3bucket',
    manifest: {
      metadata: {
        name: 's3bucket',
      },
      apiVersion: 'infrabridge.io/v1',
      kind: 'Module',
      spec: {
        moduleName: 'S3Bucket',
        version: '0.0.36-dev+test.12',
        description:
          'An S3 bucket is a storage service provided by AWS. It can be used to store files, such as images, videos, and other files. It can also be used to host static websites.\n\nThis module creates an S3 bucket.\n\n## Features\nContains the following features:\n- Set tags\n- Enable versioning\n- Enable server-side encryption\n',
        reference: 'https://github.com/infreweave-io/modules/s3bucket',
        examples: [
          {
            name: 'simple-bucket',
            description:
              '# Simple Bucket\n\nThis example creates an S3 bucket.\n\n## Description\n\nThis can be used to store files, such as images, videos, and other files.\nIt can also be used to host static websites.\n',
            variables: {
              bucketName: 'mybucket-14923',
            },
          },
          {
            name: 'advanced-bucket',
            description:
              '# Advanced Bucket\n\nThis example creates an S3 bucket with versioning enabled.\n\n## Description\n\nThis can be used to store files, such as images, videos, and other files. It is more advanced than the simple-bucket example.\n\nSome examples of advanced features include:\n- Versioning\n- Tags\n\n## Tags\n\nYou can set tags like this:\n```yaml\ntags:\n  Name: mybucket-14923\n  Environment: dev\n```\n',
            variables: {
              bucketName: 'mybucket-14923',
              tags: {
                Environment: 'dev',
                Name: 'mybucket-14923',
              },
            },
          },
        ],
        cpu: '1024',
        memory: '4096',
      },
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
    tf_variables: [
      {
        name: 'bucket_name',
        type: 'string',
        default: null,
        description:
          'Name of the S3 bucket. This must be globally unique and can contain only lowercase letters, numbers, hyphens, and periods. It must be between 3 and 63 characters long.',
        nullable: true,
        sensitive: false,
      },
      {
        name: 'enable_acl',
        type: 'bool',
        default: false,
        description:
          'Enable ACL for the S3 bucket. If set to true, the bucket will be created with a bucket policy that grants full control to the AWS account owner.',
        nullable: false,
        sensitive: false,
      },
      {
        name: 'tags',
        type: 'map(string)',
        default: {
          Test: 'override-me',
        },
        description: '',
        nullable: true,
        sensitive: false,
      },
    ],
    tf_outputs: [
      {
        name: 'bucket_arn',
        value: '',
        description: '',
      },
      {
        name: 'region',
        value: '',
        description: '',
      },
      {
        name: 'sse_algorithm',
        value: '',
        description: '',
      },
      {
        name: 'tags',
        value: '',
        description: '',
      },
    ],
    s3_key: 's3bucket/s3bucket-0.0.36-dev+test.12.zip',
    stack_data: null,
    version_diff: {
      added: [],
      changed: [],
      removed: [],
      previous_version: '0.0.36-dev+test.11',
    },
    cpu: '1024',
    memory: '4096',
  },
];
