import OpenAI from "openai";
import * as core from "@actions/core";
import type { Optional } from "ts-roids";

interface ForensicsTrace {
  timeline: {
    phase: string;
    goal: string;
    changes: string[];
  }[];
  modulesTouched: string[];
  notablePatterns: string[];
  validatedChanges: string[];
}

function createForensicsPrompt(
  commitMessages: string,
  diffSummary: string,
  filesChanged: string
): { prompt: { system: string; user: string } } {
  const system = `You are a forensic software historian tasked with producing legally admissible reconstructions of pull request activity. Your mandate is to base your analysis strictly on commit messages, file changes, and diffs. You are not permitted to speculate or hallucinate. If something is not directly supported by the input, you must ignore it. The final product must be a structured JSON with explicitly validated claims. Every statement must be traceable to a specific diff or commit line. You operate under zero-trust assumptions, like a forensic auditor in a regulatory investigation.`;

  const user = `Given the following pull request data, reconstruct the validated timeline of changes and categorize the scope and patterns of modifications.

Your output MUST be valid JSON matching exactly this structure:
{
  "timeline": [
    { "phase": "string", "goal": "string", "changes": ["string"] }
  ],
  "modulesTouched": ["string"],
  "notablePatterns": ["string"],
  "validatedChanges": ["string"]
}

Definitions:
- "phase" groups changes chronologically (e.g., "initial setup", "refactoring", "final polishing").
- "goal" describes the developer's intent inferred ONLY from commit messages or comments in code.
- "changes" must describe technical changes with as much granularity as possible, citing functions or filenames if mentioned.
- "modulesTouched" refers to logical units or directories (e.g., "auth", "frontend/hooks").
- "notablePatterns" may include patterns like: repeated rename+refactor, file deletions with no replacement, large-scale regex rewrites, etc.
- "validatedChanges" are changes confirmed explicitly by multiple independent signals in the diff and commit history.

Use ONLY the data below. Do not introduce outside knowledge or assumptions.

--- BEGIN PR DATA ---

Commit Messages:
${commitMessages}

Changed Files:
${filesChanged}

Diff Summary:
${diffSummary}

--- END PR DATA ---`;

  return { prompt: { system, user } };
}

function createSummaryPromptV2(
  prTitle: string,
  prDescription: string,
  diffSummary: string,
  forensicsTrace: ForensicsTrace
): { prompt: { system: string; user: string } } {
  const system = `You are a technical explainer. You only produce direct prose explanations of software changes without any interpretative scaffolding, summarization, or simplification. You write as if reporting to an engineer who is debugging the repo two years later and needs exact descriptions of what was modified, where, and how — no assumptions, no analysis, only observable facts.`;

  const timelineText = forensicsTrace.timeline
    .map(
      (t) =>
        `Phase: ${t.phase}\nGoal: ${t.goal}\nChanges:\n- ${t.changes.join("\n- ")}`
    )
    .join("\n\n");

  const user = `Describe exactly what changed in the pull request. Your description must be linear and match the sequence and scope in the timeline and diff.

Only describe what is explicitly shown in the data. Do not summarize, interpret, infer, or editorialize. Your prose should read like:
- "The function X was renamed to Y in file A.js."
- "Lines initializing the Z handler were removed from B.ts."

Use plain, granular, linear technical language. Do not refer to \u201ccommit\u201d, \u201cPR\u201d, or \u201csummary\u201d. This is a factual report.

PR Title: ${prTitle}
PR Description (for tone/context only): ${prDescription}

Diff Summary:
${diffSummary}

Change Timeline:
${timelineText}

Modules Touched: ${forensicsTrace.modulesTouched.join(", ")}

Observed Patterns: ${forensicsTrace.notablePatterns.join(", ")}`;

  return { prompt: { system, user } };
}

const OPENAI_API_KEY = core.getInput("OPENAI_API_KEY");
const OPENAI_API_MODEL = core.getInput("OPENAI_API_MODEL") ?? "gpt-4o";

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

export async function getAISummary({
  commitMessages,
  diffSummary,
  filesChanged,
  prDescription,
  prTitle,
}: {
  filesChanged: string;
  prTitle: string;
  prDescription: string;
  commitMessages: string;
  diffSummary: string;
}): Promise<Optional<string>> {
  try {
    const forensicsPrompt = createForensicsPrompt(
      commitMessages,
      diffSummary,
      filesChanged
    );

    const forensicsResponse = await openai.chat.completions.create({
      model: OPENAI_API_MODEL,
      messages: [
        { role: "system", content: forensicsPrompt.prompt.system },
        { role: "user", content: forensicsPrompt.prompt.user },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      seed: 69,
    });

    let forensicsTrace: ForensicsTrace;
    try {
      forensicsTrace = JSON.parse(
        forensicsResponse.choices[0].message?.content?.trim() ?? "{}"
      );
    } catch (parseError) {
      core.warning(`Failed to parse forensics response: ${parseError}`);
      forensicsTrace = {
        timeline: [],
        modulesTouched: [],
        notablePatterns: [],
        validatedChanges: [],
      };
    }

    const isForensicsWeak =
      !forensicsTrace.timeline.length ||
      !forensicsTrace.modulesTouched.length ||
      !forensicsTrace.notablePatterns.length;

    if (isForensicsWeak) {
      core.warning(
        "Forensics output is weak, falling back to enriched summary mode."
      );
      forensicsTrace = {
        timeline: [
          {
            phase: "fallback",
            goal: "summarize all available changes",
            changes: [commitMessages, filesChanged, diffSummary],
          },
        ],
        modulesTouched: [],
        notablePatterns: [],
        validatedChanges: [],
      };
    }

    const summaryPrompt = createSummaryPromptV2(
      prTitle,
      prDescription,
      diffSummary,
      forensicsTrace
    );

    const summaryResponse = await openai.chat.completions.create({
      model: OPENAI_API_MODEL,
      messages: [
        { role: "system", content: summaryPrompt.prompt.system },
        { role: "user", content: summaryPrompt.prompt.user },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      seed: 69,
    });

    return summaryResponse.choices[0].message?.content?.trim() ?? null;
  } catch (error) {
    core.warning(
      `AI API Error: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}
