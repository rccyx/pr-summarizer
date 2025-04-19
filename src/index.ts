import * as core from "@actions/core";
import { readFileSync } from "fs";
import parseDiff from "parse-diff";
import { minimatch } from "minimatch";

import { getPRDetails, createComment, getDiff } from "./githubService";
import { summarizeChanges } from "./summaryService";
import { Optional } from "./types";

async function main() {
  try {
    core.info("Starting code summarization process...");

    const prDetails = await getPRDetails();
    core.info(`Analyzing PR #${prDetails.pull_number}: ${prDetails.title}`);

    let diff: Optional<string>;
    const eventData = JSON.parse(
      readFileSync(process.env.GITHUB_EVENT_PATH ?? "", "utf8")
    );

    if (eventData.action === "opened" || eventData.action === "synchronize") {
      diff = await getDiff(
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

    const summary = await summarizeChanges(filteredDiff, prDetails);
    if (summary) {
      const ownerType = core.getInput("owner") ?? "bot";
      const useAuthorIdentity = ownerType === "author";

      await createComment(
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
