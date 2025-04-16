export interface PRDetails {
  owner: string;
  repo: string;
  pull_number: number;
  title: string;
  description: string;
  author: string;
  commits: {
    sha: string;
    message: string;
  }[];
}
