export const projects = [
  {
    PK: 'PROJECTS',
    SK: 'PROJECT#123808927999',
    description: 'The development account',
    name: 'Dev Account 22',
    project_id: '123808927999',
    region_map: {
      'eu-central-1': { git_provider: 'gitlab', project_id: '123456789' },
      'us-east-1': { git_provider: 'gitlab', project_id: '1234567' },
      'us-west-2': { git_provider: 'gitlab', project_id: '123456700' },
    },
    regions: ['eu-central-1', 'us-west-2', 'us-east-1'],
    repositories: [
      {
        git_provider: 'github',
        git_url: 'https://github.com/infraweave/dev-account-22',
        repository_path: 'infraweave/dev-account-22',
        type: 'webhook',
      },
    ],
  },
  {
    PK: 'PROJECTS',
    SK: 'PROJECT#123808927998',
    description: 'The staging account',
    name: 'Staging Account 22',
    project_id: '123808927998',
    region_map: {
      'eu-central-1': { git_provider: 'gitlab', project_id: '123456789' },
      'us-east-1': { git_provider: 'gitlab', project_id: '1234567' },
      'us-west-2': { git_provider: 'gitlab', project_id: '123456700' },
    },
    regions: ['eu-central-1', 'us-west-2'],
    repositories: [
      {
        git_provider: 'github',
        git_url: 'https://github.com/infraweave/staging-account-22',
        repository_path: 'infraweave/staging-account-22',
        type: 'webhook',
      },
    ],
  },
  {
    PK: 'PROJECTS',
    SK: 'PROJECT#123808927997',
    description: 'The development account',
    name: 'Prod Account 22',
    project_id: '123808927997',
    region_map: {
      'eu-central-1': { git_provider: 'gitlab', project_id: '123456789' },
      'us-east-1': { git_provider: 'gitlab', project_id: '1234567' },
      'us-west-2': { git_provider: 'gitlab', project_id: '123456700' },
    },
    regions: ['eu-central-1', 'us-west-2'],
    repositories: [
      {
        git_provider: 'github',
        git_url: 'https://github.com/infraweave/prod-account-22',
        repository_path: 'infraweave/prod-account-22',
        type: 'webhook',
      },
    ],
  },
];
