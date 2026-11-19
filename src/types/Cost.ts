export type CostGranularity = 'MONTHLY' | 'DAILY' | 'HOURLY';

export interface CostGroup {
  /** One value per group-by dimension, in the order they were requested. */
  keys: string[];
  amount: number;
}

export interface CostPeriod {
  start: string;
  end: string;
  /** Cost Explorer has not finalized this period yet. */
  estimated: boolean;
  total: number;
  groups: CostGroup[];
}

/** `GET /api/v1/cost/{project}/{region}/{environment}/{deployment_id}` */
export interface DeploymentCost {
  project_id: string;
  region: string;
  environment: string;
  deployment_id: string;
  tag_key: string;
  tag_value: string;
  granularity: CostGranularity;
  metric: string;
  group_by: string[];
  start: string;
  end: string;
  unit: string;
  total: number;
  /** Whole range per dimension value, largest first. */
  groups: CostGroup[];
  periods: CostPeriod[];
}

export interface DeploymentAmount {
  deployment_id: string;
  amount: number;
}

export interface KeyAmount {
  /** A value of the `group_by` dimension, e.g. `Amazon Simple Storage Service`. */
  key: string;
  amount: number;
}

/**
 * `GET /api/v1/costs/{project}/{region}`: the cost of the deployments in one account. Only
 * resources tagged with a deployment id are counted.
 */
export interface AccountCosts {
  tag_key: string;
  project_id: string;
  granularity: CostGranularity;
  start: string;
  end: string;
  metric: string;
  /** The dimension the costs are broken down by, if any. */
  group_by: string | null;
  unit: string;
  /** Some of the range is not finalized by Cost Explorer yet. */
  estimated: boolean;
  total: number;
  /** Largest first. Deployments without any cost are not listed. */
  deployments: DeploymentAmount[];
  /** Per `group_by` value, largest first. Only with `group_by`. */
  groups?: KeyAmount[];
  /** Per deployment and `group_by` value, largest first. Only with `group_by`. */
  breakdown?: (DeploymentAmount & { key: string })[];
  periods: {
    start: string;
    end: string;
    estimated: boolean;
    total: number;
    deployments: DeploymentAmount[];
    groups?: KeyAmount[];
  }[];
}

/** `GET /api/v1/cost_resources/{project}/{region}`: cost per resource, last 14 days at most. */
export interface ResourceCosts {
  tag_key: string;
  project_id: string;
  start: string;
  end: string;
  metric: string;
  unit: string;
  estimated: boolean;
  total: number;
  /** Largest first. */
  resources: { deployment_id: string; resource_id: string; amount: number }[];
}

/** `GET /api/v1/cost_tags/{project}/{region}`: cost allocation tag keys with cost in an account. */
export interface CostTagKeys {
  project_id: string;
  start: string;
  end: string;
  /** Never the deployment id tag. */
  tag_keys: string[];
}
