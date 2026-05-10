export type ModuleExample = {
  name: string;
  description: string;
  variables: object;
};

export type Module = {
  module: string;
  module_name: string;
  module_type: string;
  track: string;
  version: string;
  s3_key?: string;
  description: string;
  reference: string;
  timestamp: string;
  deprecated?: boolean;
  deprecated_message?: string;
  manifest: {
    spec: {
      examples: [ModuleExample];
      variables?: Record<string, any>;
      outputs?: Record<string, any>;
    };
  };
  tf_variables: [TfVariable];
  tf_required_providers: [TfRequiredProvider];
  tf_lock_providers: [TfLockProvider];
  tf_outputs: [
    {
      name: string;
      description: string;
      sensitive: boolean;
    },
  ];
  stack_data?: {
    modules: [
      {
        module: string;
        version: string;
        s3_key: string;
        track: string;
      },
    ];
  };
  version_diff?: VersionDiff;
};

export interface VersionDiff {
  added: { path: string; value: string }[];
  changed: { path: string; old_value: string; new_value: string }[];
  removed: { path: string; value: string }[];
  moved: { oldPath: string; newPath: string; old_value: string; new_value: string }[];
  unchanged?: { path: string; value: string }[];
  previous_version: string;
}

export type TfVariable = {
  name: string;
  type: string;
  default: string;
  description: string;
  nullable: boolean;
  sensitive: boolean;
};

export type TfRequiredProvider = {
  name: string;
  source: string;
  version: string;
};

export type TfLockProvider = {
  source: string;
  version: string;
};
