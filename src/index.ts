import { readFileSync } from "fs";
import * as core from "@actions/core";
import OpenAI from "openai";
import { Octokit } from "@octokit/rest";
import parseDiff, { Chunk, File } from "parse-diff";
import { minimatch } from "minimatch";

const GITHUB_TOKEN = core.getInput("GITHUB_TOKEN");
const OPENAI_API_KEY = core.getInput("OPENAI_API_KEY");
const OPENAI_API_MODEL =
  core.getInput("OPENAI_API_MODEL") || "gpt-4-turbo-preview";
const MAX_TOKENS = 4000;
const CHUNK_SIZE = 3000;

const octokit = new Octokit({ auth: GITHUB_TOKEN });
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

interface PRDetails {
  owner: string;
  repo: string;
  pull_number: number;
  title: string;
  description: string;
  commits: Array<{
    sha: string;
    message: string;
  }>;
}

async function getPRDetails(): Promise<PRDetails> {
  const { repository, number } = JSON.parse(
    readFileSync(process.env.GITHUB_EVENT_PATH || "", "utf8")
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
    title: prResponse.data.title ?? "",
    description: prResponse.data.body ?? "",
    commits: commitsResponse.data.map((commit) => ({
      sha: commit.sha,
      message: commit.commit.message,
    })),
  };
}

function createSystemPrompt(): string {
  return `You are an expert code reviewer. Your task is to review code changes and provide constructive feedback.
Key points:
- Focus on architectural issues, potential bugs, security concerns, and performance improvements
- Be specific and actionable in your feedback
- Use markdown formatting for code examples
- Consider best practices and design patterns
- Don't comment on style/formatting unless it impacts readability
- Don't suggest adding comments unless absolutely necessary

Provide responses in JSON format:
{
  "reviews": [
    {
      "lineNumber": number,
      "reviewComment": "string",
      "severity": "high|medium|low",
      "category": "security|performance|architecture|bug|improvement"
    }
  ]
}`;
}

function createReviewPrompt(
  file: File,
  chunk: Chunk,
  prDetails: PRDetails
): string {
  const commitMessages = prDetails.commits
    .map((c) => `- ${c.message}`)
    .join("\n");

  return `Review the following code changes:

Context:
- File: ${file.to}
- PR Title: ${prDetails.title}
- PR Description: ${prDetails.description}

Commit Messages:
${commitMessages}

Changes to Review:
\`\`\`diff
${chunk.content}
${chunk.changes.map((c) => `${c.ln || c.ln2 || ""} ${c.content}`).join("\n")}
\`\`\`

Provide specific, actionable feedback for these changes. Focus on:
1. Potential bugs or issues
2. Security concerns
3. Performance implications
4. Architectural improvements
5. Best practices violations

Respond in the specified JSON format.`;
}

async function getAIResponse(prompt: string): Promise<Array<{
  lineNumber: number;
  reviewComment: string;
  severity: string;
  category: string;
}> | null> {
  try {
    const response = await openai.chat.completions.create({
      model: OPENAI_API_MODEL,
      messages: [
        { role: "system", content: createSystemPrompt() },
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
      max_tokens: MAX_TOKENS,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message?.content?.trim() || "{}";
    return JSON.parse(content).reviews;
  } catch (error) {
    core.warning(
      `AI API Error: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}

async function analyzeCode(
  parsedDiff: File[],
  prDetails: PRDetails
): Promise<Array<{ body: string; path: string; line: number }>> {
  const comments: Array<{ body: string; path: string; line: number }> = [];

  for (const file of parsedDiff) {
    if (file.to === "/dev/null") continue;

    for (const chunk of file.chunks) {
      const prompt = createReviewPrompt(file, chunk, prDetails);
      const aiResponse = await getAIResponse(prompt);

      if (aiResponse?.length) {
        const formattedComments = aiResponse.map((review) => ({
          body: `**${review.category.toUpperCase()}** _(${review.severity} severity)_\n\n${review.reviewComment}`,
          path: file.to!,
          line: review.lineNumber,
        }));
        comments.push(...formattedComments);
      }
    }
  }

  return comments;
}

async function createReviewComment(
  owner: string,
  repo: string,
  pull_number: number,
  comments: Array<{ body: string; path: string; line: number }>
): Promise<void> {
  await octokit.pulls.createReview({
    owner,
    repo,
    pull_number,
    comments,
    event: "COMMENT",
  });
}

async function main() {
  try {
    core.info("Starting code review process...");

    const prDetails = await getPRDetails();
    core.info(`Analyzing PR #${prDetails.pull_number}: ${prDetails.title}`);

    let diff: string | null;
    const eventData = JSON.parse(
      readFileSync(process.env.GITHUB_EVENT_PATH ?? "", "utf8")
    );

    if (eventData.action === "opened") {
      diff = await getDiff(
        prDetails.owner,
        prDetails.repo,
        prDetails.pull_number
      );
    } else if (eventData.action === "synchronize") {
      const newBaseSha = eventData.before;
      const newHeadSha = eventData.after;

      const response = await octokit.repos.compareCommits({
        headers: {
          accept: "application/vnd.github.v3.diff",
        },
        owner: prDetails.owner,
        repo: prDetails.repo,
        base: newBaseSha,
        head: newHeadSha,
      });

      diff = String(response.data);
    } else {
      console.log("Unsupported event:", process.env.GITHUB_EVENT_NAME);
      return;
    }

    if (!diff) {
      console.log("No diff found");
      return;
    }

    const parsedDiff = parseDiff(diff);

    const excludePatterns = core
      .getInput("exclude")
      .split(",")
      .map((s) => s.trim());

    const filteredDiff = parsedDiff.filter((file) => {
      return !excludePatterns.some((pattern) =>
        minimatch(file.to ?? "", pattern)
      );
    });

    const comments = await analyzeCode(filteredDiff, prDetails);
    if (comments.length > 0) {
      await createReviewComment(
        prDetails.owner,
        prDetails.repo,
        prDetails.pull_number,
        comments
      );
    }
  } catch (error) {
    core.setFailed(
      `Action failed: ${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }
}

main().catch((error) => {
  core.setFailed(
    `Unhandled error: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
});
