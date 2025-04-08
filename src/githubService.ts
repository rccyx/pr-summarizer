import { readFileSync } from "fs";
import * as core from "@actions/core";
import { Octokit } from "@octokit/rest";
import { PRDetails } from "./types";

const GITHUB_TOKEN = core.getInput("GITHUB_TOKEN");
const octokit = new Octokit({ auth: GITHUB_TOKEN });

export async function getPRDetails(): Promise<PRDetails> {
  const { repository, number } = JSON.parse(
    readFileSync(process.env.GITHUB_EVENT_PATH || "", "utf8"),
  );

  const [prResponse, commitsResponse] = await Promise.all([
    octokit.pulls.get({
      owner: repository.owner.login,
      repo: repository.name,
      pull_number: number,
    }),
    octokit.pulls.listCommits({
      owner: repository.owner.login,
      repo: repository.name,
      pull_number: number,
    }),
  ]);

  return {
    owner: repository.owner.login,
    repo: repository.name,
    pull_number: number,
    title: prResponse.data.title || "",
    description: prResponse.data.body || "",
    commits: commitsResponse.data.map((commit) => ({
      sha: commit.sha,
      message: commit.commit.message,
    })),
  };
}

export async function createReviewComment(
  owner: string,
  repo: string,
  pull_number: number,
  comments: Array<{ body: string; path: string; line: number }>,
): Promise<void> {
  await octokit.pulls.createReview({
    owner,
    repo,
    pull_number,
    comments,
    event: "COMMENT",
  });
}

export async function getDiff(
  owner: string,
  repo: string,
  pull_number: number,
): Promise<string | null> {
  try {
    const response = await octokit.pulls.get({
      owner,
      repo,
      pull_number,
      headers: {
        accept: "application/vnd.github.v3.diff",
      },
    });
    // the response.data is expected to be the diff string.
    return response.data as unknown as string;
  } catch (error) {
    core.warning(
      `Error getting diff: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return null;
  }
}
