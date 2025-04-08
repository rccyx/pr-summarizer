import { File } from "parse-diff";
import { getAISummary, createSummarySystemPrompt } from "./aiService";
import { PRDetails } from "./types";

export async function summarizeChanges(
  parsedDiff: File[],
  prDetails: PRDetails
): Promise<string | null> {
  const filesChanged = parsedDiff.map((file) => file.to || "").join(", ");

  const commitMessages = prDetails.commits
    .map((c) => `- ${c.message}`)
    .join("\n");

  let diffSummary = "";
  for (const file of parsedDiff) {
    diffSummary += `${file.to || "unknown file"}: ${file.chunks.length} change(s) detected.\n`;
  }

  const prompt = createSummarySystemPrompt({
    filesChanged,
    prTitle: prDetails.title,
    prDescription: prDetails.description,
    commitMessages,
    diffSummary,
  });

  const summary = await getAISummary({
    git: {
      filesChanged,
      prTitle: prDetails.title,
      prDescription: prDetails.description,
      commitMessages,
      diffSummary,
    },
    prompt,
  });
  return summary;
}
