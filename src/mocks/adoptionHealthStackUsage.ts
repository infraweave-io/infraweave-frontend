const MODULE_VERSIONS = [
  { track: 'dev', version: '0.0.36-dev+test.6' },
  { track: 'beta', version: '0.0.36-beta+test.3' },
  { track: 'alpha', version: '0.0.37-alpha+diagram.1' },
  { track: 'alpha', version: '0.0.38-alpha+diagram.2' },
  { track: 'beta', version: '0.0.37-beta+diagram.1' },
  { track: 'beta', version: '0.0.38-beta+diagram.2' },
  { track: 'dev', version: '0.0.37-dev+diagram.1' },
  { track: 'dev', version: '0.0.38-dev+diagram.2' },
  { track: 'dev', version: '0.0.39-dev+diagram.3' },
  { track: 'stable', version: '0.0.37+diagram.1' },
  { track: 'stable', version: '0.0.38+diagram.2' },
  { track: 'stable', version: '0.0.39+diagram.3' },
] as const;

const STACK_VERSION_COUNT = 20;
const STACK_NAME_COUNT = 8;
const MODULE_OFFSETS_BY_RELEASE = [
  [0, 3, 6, 9],
  [0, 2, 5, 8],
  [0, 4, 7, 10],
] as const;

/** Synthetic stack fixtures cover varied deployed module versions for Adoption & Health. */
export const adoptionHealthStacks = Array.from({ length: STACK_VERSION_COUNT }, (_, index) => {
  const stackNameIndex = index % STACK_NAME_COUNT;
  const number = String(stackNameIndex + 1).padStart(2, '0');
  const releaseIndex = Math.floor(index / STACK_NAME_COUNT);
  const module = `diagram-stack-${number}`;
  const version = `0.1.${index + 1}-dev+adoption.1`;
  const modules = MODULE_OFFSETS_BY_RELEASE[releaseIndex].map((offset) => {
    const component = MODULE_VERSIONS[(stackNameIndex + offset) % MODULE_VERSIONS.length];
    return {
      module: 's3bucket',
      track: component.track,
      s3_key: `s3bucket/s3bucket-${component.version}.zip`,
      version: component.version,
    };
  });

  return {
    module,
    module_name: `Diagram Stack ${number}`,
    module_type: 'stack',
    track: 'dev',
    version,
    stack_data: { modules },
  };
});

const PROJECTS = [
  { id: '123808927999', environment: 'dev' },
  { id: '123808927998', environment: 'staging' },
  { id: '123808927997', environment: 'prod' },
] as const;
const REGIONS = ['us-west-2', 'eu-central-1'] as const;
const STATUSES = ['successful', 'failed', 'pending'] as const;

const makeDeployment = (
  stack: (typeof adoptionHealthStacks)[number],
  stackIndex: number,
  replica: number,
) => {
  const project = PROJECTS[(stackIndex + replica) % PROJECTS.length];
  const region = REGIONS[replica];
  const deploymentId = `${stack.module}-v${stackIndex + 1}-${region}`;
  const key = `DEPLOYMENT#${project.id}::${region}::${project.environment}::${deploymentId}`;

  return {
    PK: key,
    SK: 'METADATA',
    deleted: 0,
    deleted_PK: `1|${key}`,
    deleted_PK_base: `1|DEPLOYMENT#${project.id}::${region}`,
    deleted_SK_base: `1|METADATA#${project.id}::${region}`,
    dependencies: [],
    deployment_id: deploymentId,
    drift_detection: {
      auto_remediate: false,
      enabled: replica === 0,
      interval: '1h',
      webhooks: [],
    },
    environment: project.environment,
    epoch: Date.now() - (stackIndex * REGIONS.length + replica) * 60_000,
    error_text: '',
    has_drifted: false,
    initiated_by: `arn:aws:iam::${project.id}:user/infraweave-api-access`,
    job_id: `adoption-diagram-job-${stackIndex + 1}-${replica + 1}`,
    module: stack.module,
    module_PK_base: `MODULE#${project.id}::${region}#${stack.module}`,
    module_track: 'dev',
    module_type: 'stack',
    module_version: stack.version,
    next_drift_check_epoch: -1,
    output: null,
    policy_results: [],
    project_id: project.id,
    region,
    status: STATUSES[(stackIndex + replica) % STATUSES.length],
    variables: {},
  };
};

/** Two deployments per stack version create varied account and region counts. */
export const adoptionHealthStackDeployments = adoptionHealthStacks.flatMap((stack, stackIndex) =>
  REGIONS.map((_, replica) => makeDeployment(stack, stackIndex, replica)),
);
