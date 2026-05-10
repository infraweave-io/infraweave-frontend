export type { Project, RepositoryData } from './Project';

export type Dependency = {
  environment: string;
  deployment_id: string;
};

export type Dependant = {
  environment: string;
  deployment_id: string;
};

export type PolicyResult = {
  policy: string;
  version: string;
  environment: string;
  description: string;
  policy_name: string;
  failed: boolean;
  violations: object;
};

export type Deployment = {
  deployment_id: string;
  status: string;
  project_id: string;
  region: string;
  environment: string;
  module: string;
  drift_detection: {
    enabled: boolean;
    interval: string;
    auto_remediate: boolean;
  };
  next_drift_check_epoch: number;
  initiated_by: string;
  epoch: number;
  job_id: string;
  module_version: string;
  module_type: string;
  module_track: string;
  variables: {
    [key: string]: string;
  };
  dependencies: Dependency[];
  dependants: Dependant[];
  reference: string;
  error_text: string;
  output: object;
  has_drifted: boolean;
  policy_results: PolicyResult[];
  tf_resources?: string[];
  deleted?: boolean;
  change_type?: string;
};
