import * as core from "@actions/core";
import { readFileSync } from "fs";
import parseDiff from "parse-diff";
import { minimatch } from "minimatch";

import { GitHubService } from "./services/github";
import { SummaryService } from "./services/summary";
import { AiService } from "./services/ai";
import { Optional } from "./types";

async function main() {
  core.info("Starting code summarization process...");

  const GITHUB_TOKEN = core.getInput("GITHUB_TOKEN");
  const OPENAI_API_KEY = core.getInput("OPENAI_API_KEY");
  const OPENAI_API_MODEL = core.getInput("OPENAI_API_MODEL");

  try {
    const githubService = new GitHubService({
      GITHUB_TOKEN,
    });

    const prDetails = await githubService.getPRDetails();
    core.info(`Analyzing PR #${prDetails.pull_number}: ${prDetails.title}`);

    let diff: Optional<string>;
    const eventData = JSON.parse(
      readFileSync(process.env.GITHUB_EVENT_PATH ?? "", "utf8")
    );

    if (eventData.action === "opened" || eventData.action === "synchronize") {
      diff = await githubService.getDiff(
        prDetails.owner,
        prDetails.repo,
        prDetails.pull_number
      );
    } else {
      core.info("Unsupported event: " + process.env.GITHUB_EVENT_NAME);
      return;
    }

    if (!diff) {
      core.info("No diff found");
      return;
    }

    const parsedDiff = parseDiff(diff);

    const excludePatterns = core
      .getInput("exclude")
      .split(",")
      .map((s) => s.trim());

    const filteredDiff = parsedDiff.filter((file) => {
      const filePath = file.to ?? "";
      return !excludePatterns.some((pattern) => minimatch(filePath, pattern));
    });

    const summary = await SummaryService.summarize({
      aiService: new AiService({
        apiKey: OPENAI_API_KEY,
        model: OPENAI_API_MODEL,
      }),
      parsedDiff: filteredDiff,
      prDetails,
    });

    if (summary) {
      const ownerType = core.getInput("owner") ?? "bot";
      const useAuthorIdentity = ownerType === "author";

      await githubService.createComment(
        prDetails.owner,
        prDetails.repo,
        prDetails.pull_number,
        summary,
        useAuthorIdentity,
        useAuthorIdentity ? prDetails.author : undefined
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
