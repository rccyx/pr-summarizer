export interface PRDetails {
  owner: string;
  repo: string;
  pull_number: number;
  title: string;
  description: string;
  author: string; // GitHub username of the PR author
  commits: Array<{
    sha: string;
    message: string;
  }>;
}
