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
  const system = `You are a forensic code analyst specializing in PR history reconstruction.
You analyze commit patterns, diffs, and file changes to create validated change timelines.
You think systematically and focus on concrete evidence, never assuming or inferring without proof.
You must return your analysis in valid JSON format.`;

  const user = `Analyze this PR's history to create a validated timeline of changes.
Return your analysis in the following JSON format:
{
  "timeline": [
    { "phase": "string", "goal": "string", "changes": ["string"] }
  ],
  "modulesTouched": ["string"],
  "notablePatterns": ["string"],
  "validatedChanges": ["string"]
}

PR Information:
Commit Messages:
${commitMessages}

Changed Files:
${filesChanged}

Final Diff:
${diffSummary}`;

  return { prompt: { system, user } };
}

function createSummaryPromptV2(
  prTitle: string,
  prDescription: string,
  diffSummary: string,
  forensicsTrace: ForensicsTrace
): { prompt: { system: string; user: string } } {
  const system = `You are a senior engineer writing full-scope narrative summaries of pull requests. You do not add structure, summaries, advice, or interpretation. You write in dense technical prose that fully describes the code change — linearly, precisely, and without generalization. Your output reads like a colleague describing exactly what happened in a PR, in total, without skipping anything.`;

  const timelineText = forensicsTrace.timeline
    .map((t) => `- [${t.phase}] ${t.goal}: ${t.changes.join(", ")}`)
    .join("\n");

  const user = `Describe the pull request exactly as it is. Write a full, continuous technical narrative that explains what was changed, how, and where — in as much detail as possible. Do not summarize. Do not comment. Do not suggest. Just say exactly what changed, in prose, without skipping anything. The diff summary and timeline are the factual source of truth. The PR description is only for context or tone. You must include all relevant technical details, module references, and relationship of changes, but only if they are present in the data. Do not invent or infer anything.

PR Title: ${prTitle}

PR Description: ${prDescription}

Diff Summary: ${diffSummary}

Change Timeline:
${timelineText}

Affected Modules: ${forensicsTrace.modulesTouched.join(", ")}

Patterns Observed: ${forensicsTrace.notablePatterns.join(", ")}`;

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
      forensicsTrace = {
        timeline: [],
        modulesTouched: [],
        notablePatterns: [],
        validatedChanges: [],
      };
      core.warning(`Failed to parse forensics response: ${parseError}`);
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
      temperature: 0.7,
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
