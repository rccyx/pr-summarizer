import { File } from "parse-diff";
import { getAISummary, createSummaryPrompt } from "./aiService";
import { PRDetails } from "./types";

export async function summarizeChanges(
  parsedDiff: File[],
  prDetails: PRDetails
): Promise<string | null> {
  const filesChanged = parsedDiff
    .map((file) => {
      if (file.deleted) return `${file.from} (deleted)`;
      if (file.new) return `${file.to} (new)`;
      return file.to ?? "";
    })
    .filter(Boolean)
    .join(", ");

  const commitMessages = prDetails.commits
    .map((c) => `- ${c.message}`)
    .join("\n");

  let diffSummary = "";
  for (const file of parsedDiff) {
    const status = file.deleted ? "deleted" : file.new ? "new" : "modified";
    const path = file.deleted ? file.from : file.to;
    diffSummary += `${path || "unknown file"} (${status}): ${file.chunks.length} change(s) detected.\n`;
  }

  const summary = await getAISummary({
    filesChanged,
    prTitle: prDetails.title,
    prDescription: prDetails.description,
    commitMessages,
    diffSummary,
  });

  if (!summary) return null;

  const formattedSummary = `## PR Summary

${summary
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line)
  .join("\n\n")}

### Files Changed
${parsedDiff
  .map((file) => {
    if (file.deleted) return `- \`${file.from}\` 🗑️ (deleted)`;
    if (file.new) return `- \`${file.to}\` ✨ (new)`;
    return `- \`${file.to}\` 📝 (modified)`;
  })
  .filter(Boolean)
  .join("\n")}`;

  return formattedSummary;
}
