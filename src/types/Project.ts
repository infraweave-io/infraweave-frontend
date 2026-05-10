export type RepositoryData = {
  git_provider: string;
  git_url: string;
  repository_path: string;
  type: string;
};

export type Project = {
  project_id: string;
  name: string;
  description: string;
  regions: string[];
  repositories: RepositoryData[];
};
