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
  const system = `You are a senior infrastructure engineer writing a high-quality PR summary. 
You focus on architecture, implementation rationale, and change risk. 
You write like you're explaining this PR to another engineer in your team during review. 
Your writing is clear, precise, and reads naturally — never robotic or templated.`;

  const timelineText = forensicsTrace.timeline
    .map((t) => `- [${t.phase}] ${t.goal}: ${t.changes.join(", ")}`)
    .join("\n");

  const user = `You are tasked with writing a high-quality narrative summary of a pull request for engineering leadership. 
Do not use sections, bullet points, or headers. Write it as a cohesive, technical paragraph that flows logically and reads like a smart engineer explaining the change to another one.

Your goal is to answer:
- What problem does this PR solve?
- How was it solved, architecturally?
- What files/modules were affected, and how do they relate?
- Were there any key patterns, migrations, or risks?
- Is there downstream or infra impact?

Use the forensics timeline and diff summary as your main source of truth. The PR description provides context — use it to inform tone, not facts.

PR Title: ${prTitle}

PR Description: ${prDescription}

Code Diff Summary: ${diffSummary}

Validated Change Timeline: \n${timelineText}

Touched Modules: ${forensicsTrace.modulesTouched.join(", ")}

Identified Patterns: ${forensicsTrace.notablePatterns.join(", ")}`;

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
