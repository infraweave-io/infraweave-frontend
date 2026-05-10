export type Provider = {
  PK?: string;
  SK?: string;
  name: string;
  // provider field is not in the JSON, but was used in the code.
  // We'll remove it or make it optional if we want to keep compatibility with some other potential response
  provider?: string;
  track?: string;
  version: string;
  description: string;
  reference: string;
  timestamp: string;
  s3_key?: string;
  s3Key?: string;
  download_url?: string;
  downloadUrl?: string;
  s3_url?: string;
  s3Url?: string;
  url?: string;
  link?: string;
  module_name?: string;
  provider_name?: string;
  manifest?: {
    apiVersion?: string;
    kind?: string;
    metadata?: {
      name: string;
    };
    spec?: {
      alias?: string | null;
      description?: string;
      provider?: string;
      reference?: string;
      version?: string;
    };
  };
  tf_extra_environment_variables?: string[];
  tf_variables?: TfVariable[];
  tf_required_providers?: TfRequiredProvider[];
  tf_lock_providers?: TfLockProvider[];
  tf_outputs?: {
    name: string;
    description: string;
    sensitive: boolean;
  }[];
};

export type TfVariable = {
  name: string;
  description: string;
  type: string;
  default: any;
  nullable: boolean;
  sensitive: boolean;
};

export type TfRequiredProvider = {
  source: string;
  version: string;
};

export type TfLockProvider = {
  source: string;
  version: string;
};
