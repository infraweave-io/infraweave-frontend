export interface MergeRequestOptions {
  repositoryPath: string;
  sourceBranch: string;
  targetBranch: string;
  title: string;
  description?: string;
  filePath: string;
  fileContent: string;
  commitMessage: string;
}

export interface MergeRequest {
  web_url: string;
}
