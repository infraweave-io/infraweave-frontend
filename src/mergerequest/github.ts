import { MergeRequest, MergeRequestOptions } from '../types/MergeRequest';

async function createGithubPullRequestWithFile(
  options: MergeRequestOptions,
): Promise<MergeRequest> {
  try {
    const response = await fetch('/api/infraweave-backend-github/pull-request-with-file', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options),
    });

    if (!response.ok) {
      throw new Error(`Failed to create pull request: ${response.statusText}`);
    }

    const result = await response.json();
    return result as MergeRequest;
  } catch (error) {
    console.error('Error creating merge request with file:', error);
    return Promise.reject(error);
  }
}

export default createGithubPullRequestWithFile;
