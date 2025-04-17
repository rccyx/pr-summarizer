import { File } from "parse-diff";
import { getAISummary } from "./aiService";
import { PRDetails } from "./types";

export async function summarizeChanges(
  parsedDiff: File[],
  prDetails: PRDetails
): Promise<string | null> {
  const changedFiles = parsedDiff.filter(
    (file) => file.to && file.to !== "/dev/null"
  );

  const filesChanged = changedFiles.map((file) => file.to!).join(", ");

  const commitMessages = prDetails.commits
    .map((c) => `- ${c.message}`)
    .join("\n");

  let diffSummary = "";
  for (const file of parsedDiff) {
    const fileName = file.to || file.from || "unknown file";
    const changes = file.chunks?.length || 0;
    diffSummary += `${fileName}: ${changes} change(s) detected.\n`;
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
    if (file.deleted) {
      // deleted
      return `- \`${file.from ?? "unknown file"}\` (deleted)`;
    } else if (file.new) {
      // new
      return `- \`${file.to ?? "unknown file"}\` (new)`;
    } else if (file.to && file.to !== "/dev/null") {
      // renamed
      return `- \`${file.from ?? "unknown"}\` ➜ \`${file.to ?? "unknown"}\` (renamed)`;
    } else if (file.to && file.to !== "/dev/null") {
      // modified
      return `- \`${file.to}\` (modified)`;
    } else {
      return null;
    }
  })
  .filter(Boolean)
  .join("\n")}`;

  return formattedSummary;
}
