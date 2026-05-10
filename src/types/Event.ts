export type Event = {
  deployment_id: string;
  status: string;
  event: string;
  module: string;
  module_version?: string;
  job_id: string;
  initiated_by: string;
  timestamp: string;
  epoch: number;
};
