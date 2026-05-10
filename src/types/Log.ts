export type Log = {
  logs: string;
  nextBackwardToken?: string;
  nextForwardToken?: string;
};

export type AttributeChange = {
  before?: any;
  after?: any;
  after_unknown?: boolean;
};

export type ResourceChange = {
  action: string;
  address: string;
  resource_type: string;
  name: string;
  changes?: Record<string, AttributeChange>;
};

export type ChangeRecord = {
  timestamp: string;
  plan_std_output?: string;
  resource_changes?: ResourceChange[];
  job_id?: string;
  deployment_id?: string;
  change_type?: string;
  module_version?: string;
  epoch?: number;
  variables?: Record<string, any>;
  error_text?: string;
  status?: string;
};
