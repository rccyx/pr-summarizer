import OpenAI from "openai";
import * as core from "@actions/core";

const OPENAI_API_KEY = core.getInput("OPENAI_API_KEY");
const OPENAI_API_MODEL = core.getInput("OPENAI_API_MODEL") ?? "gpt-4o";
const MAX_TOKENS = 4000;

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

export function createSummarySystemPrompt(): string {
  return `You are a highly skilled code summarizer. Your primary objective is to craft a succinct yet comprehensive summary of the changes made in a pull request. 
Ensure to highlight key elements such as the files impacted, the rationale behind the modifications, and any significant consequences. Avoid unnecessary commentary and focus on clarity and precision.`;
}

export function createSummaryPrompt(
  filesChanged: string,
  prTitle: string,
  prDescription: string,
  commitMessages: string,
  diffSummary: string
): string {
  return `You are a proficient code summarizer tasked with generating a clear and insightful summary of a GitHub pull request.

The summary should accurately represent the scope and complexity of the PR:
- For larger PRs that affect multiple systems, provide a detailed and thorough explanation.
- For smaller, focused PRs, maintain a concise yet informative summary.

Key points to address:
- The primary objective of the PR (e.g., feature addition, bug fix, refactor)
- The specific areas of the codebase that were modified
- The reasons for the changes (derived from the PR title, description, or commit messages)
- Any significant outcomes, implications, or potential breaking changes
- The relevance of this change within the broader context of the project

Avoid:
- Reiterating the PR title verbatim
- Enumerating every single file changed
- Using vague phrases like "updated code"
- Including subjective opinions

Below are examples of effective summaries:

---
EXAMPLE 1 (Mid-size Feature)

PR Title: Add support for secondary button variant  
Files Changed: src/components/Button.tsx, src/styles/theme.ts  
Commit Messages: Add variant, tweak hover, update theme  
Diff Summary: Added prop logic, color additions, minor visual updates

This PR introduces a new "secondary" variant to the Button component, aligning with updated design specifications. It implements conditional styling logic in Button.tsx and enhances the theme with definitions for secondary colors. Additionally, it includes minor visual adjustments for hover consistency across variants.

---
EXAMPLE 2 (Bug Fix with Edge Cases)

PR Title: Fix timezone bug in date formatting utility  
Files Changed: utils/date.ts, tests/date.test.ts  
Commit Messages: Fix UTC handling, add DST tests  
Diff Summary: Adjusted formatDate() to use local time, added DST unit tests

This PR resolves a persistent issue with the formatDate utility, where UTC was incorrectly applied in local time scenarios. The revised logic now accurately manages daylight saving time transitions, and new tests have been added to cover edge cases related to DST boundaries.

---
EXAMPLE 3 (Large Infra Refactor)

PR Title: Refactor build pipeline for modular deployments  
Files Changed: ci/, docker/, scripts/, config/, 30+ files total  
Commit Messages: Split monolith deploy, add microservice configs, update CI  
Diff Summary: Introduced per-service Dockerfiles, split CI jobs, rewrote deploy scripts

This major refactor of the deployment pipeline facilitates modular, service-specific deployments. Dockerfiles and deployment scripts have been separated by service, allowing for independent builds and quicker iterations. The CI configuration has been restructured to enable parallel execution of build/test/deploy jobs. These modifications lay the foundation for future scalability and automation in microservice deployments.

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

Please provide a summary that aligns with the complexity of the changes. Be thorough when necessary, concise when appropriate, and use clear, professional language. Begin your summary below:
`;
}

export async function getAISummary(prompt: string): Promise<string | null> {
  try {
    const response = await openai.chat.completions.create({
      model: OPENAI_API_MODEL,
      messages: [
        { role: "system", content: createSummarySystemPrompt() },
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
