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
  },
];
