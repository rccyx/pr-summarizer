import { File } from "parse-diff";
import { Optional, PRDetails } from "./types";
import { AiService } from "./services/ai";

export async function summarizeChanges(
  parsedDiff: File[],
  prDetails: PRDetails,
  aiService: AiService
): Promise<Optional<string>> {
  const changedFiles = parsedDiff.filter(
    (file) => file.to && file.to !== "/dev/null"
  );

  const filesChanged = changedFiles.map((file) => file.to!).join(", ");

  const commitMessages = prDetails.commits
    .map((c) => `- ${c.message}`)
    .join("\n");

  let diffSummary = "";
  for (const file of parsedDiff) {
    const fileName = file.to ?? file.from ?? "unknown file";
    const changes = file.chunks?.length ?? 0;
    diffSummary += `${fileName}: ${changes} change(s) detected.\n`;
  }

  const summary = await aiService.getAiSummary({
    filesChanged,
    prTitle: prDetails.title,
    prDescription: prDetails.description,
    commitMessages,
    diffSummary,
  });

  if (!summary) return null;

  const formattedSummary = `${summary
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line)
    .join("\n\n")}

${
  parsedDiff.map((file) => file.to).length > 3
    ? `#### Files Changed
${parsedDiff
  .map((file) => {
    // Check for deleted files first
    if (file.to === "/dev/null") {
      return `- \`${file.from}\` 🗑️ (deleted)`;
    }
    // Check for new files
    if (file.from === "/dev/null") {
      return `- \`${file.to}\` ✨ (new)`;
    }
    // Check for renamed files
    if (file.from && file.to && file.from !== file.to) {
      return `- \`${file.from}\` ➜ \`${file.to}\` 📝 (renamed)`;
    }
    // Modified files
    if (file.to) {
      return `- \`${file.to}\` 📝 (modified)`;
    }
    return null;
  })
  .filter(Boolean)
  .join("\n")
  // Remove any lines containing /dev/null
  .replace(/^.*\/dev\/null.*$/gm, "")}`
    : ""
}
`;

  return formattedSummary;
}
