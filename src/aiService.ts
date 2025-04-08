import OpenAI from "openai";
import * as core from "@actions/core";

const OPENAI_API_KEY = core.getInput("OPENAI_API_KEY");
const OPENAI_API_MODEL = core.getInput("OPENAI_API_MODEL") ?? "gpt-4o";
const MAX_TOKENS = 4000;

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

export function createSummarySystemPrompt({
  filesChanged,
  prTitle,
  prDescription,
  commitMessages,
  diffSummary,
}: {
  filesChanged: string;
  prTitle: string;
  prDescription: string;
  commitMessages: string;
  diffSummary: string;
}): string {
  return `You are an expert code summarizer. Your task is to produce a concise summary of a pull request's changes in a few sentences.

The summary should reflect the true scope and complexity of the PR:
- If the PR is large or touches multiple systems, provide a longer and more detailed explanation.
- If it’s small or focused, keep the summary concise but informative.
ents/Button.tsx, src/styles/theme.ts  
Commit Messages: Add variant, tweak hover, update theme  
Diff Summary: Added prop logic, color additions, minor visual updates

Summary:  
This PR adds a new "secondary" variant to the Button component, supporting updated design specifications. It introduces conditional styling logic in Button.tsx and expands the theme with secondary color definitions. Also includes small visual tweaks for hover consistency across variants.

---
EXAMPLE 2 (Bug Fix with Edge Cases)

PR Title: Fix timezone bug in date formatting utility  
Files Changed: utils/date.ts, tests/date.test.ts  
Commit Messages: Fix UTC handling, add DST tests  
Diff Summary: Adjusted formatDate() to use local time, added DST unit tests

Summary:  
Fixes a longstanding issue with the formatDate utility where UTC was incorrectly used in local time contexts. The updated logic now correctly handles daylight saving time transitions, and tests were added to ensure coverage of edge cases around DST boundaries.

---
EXAMPLE 3 (Large Infra Refactor)

PR Title: Refactor build pipeline for modular deployments  
Files Changed: ci/, docker/, scripts/, config/, 30+ files total  
Commit Messages: Split monolith deploy, add microservice configs, update CI  
Diff Summary: Introduced per-service Dockerfiles, split CI jobs, rewrote deploy scripts

Summary:  
Major refactor of the deployment pipeline to support modular, service-specific deployments. Dockerfiles and deployment scripts were split by service, enabling independent builds and faster iteration. CI configuration was restructured to parallelize build/test/deploy jobs. These changes lay the groundwork for future microservice scalability and deployment automation.

---

Now, summarize the following pull request:

Files Changed:  
${filesChanged}

PR Title:  
${prTitle}

PR Description:  
${prDescription}

Commit Messages:  
${commitMessages}

Code Diff Summary:  
${diffSummary}

Write a summary that fits the level of complexity. Be thorough when needed, concise when appropriate. Use plain, professional language. Start below:
`;
}

export async function getAISummary({
  git: { filesChanged, prTitle, prDescription, commitMessages, diffSummary },
  prompt,
}: {
  prompt: string;
  git: {
    filesChanged: string;
    prTitle: string;
    prDescription: string;
    commitMessages: string;
    diffSummary: string;
  };
}): Promise<string | null> {
  try {
    const response = await openai.chat.completions.create({
      model: OPENAI_API_MODEL,
      messages: [
        {
          role: "system",
          content: createSummarySystemPrompt({
            filesChanged,
            prTitle,
            prDescription,
            commitMessages,
            diffSummary,
          }),
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: MAX_TOKENS,
    });
    const content = response.choices[0].message?.content?.trim() ?? "";
    return content ?? null;
  } catch (error) {
    core.warning(
      `AI API Error: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}
