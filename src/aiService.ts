import OpenAI from "openai";
import * as core from "@actions/core";
import type { Optional } from "ts-roids";

export function createSummaryPrompt(
  filesChanged: string,
  prTitle: string,
  prDescription: string,
  commitMessages: string,
  diffSummary: string
): {
  prompt: {
    system: string;
    user: string;
  };
} {
  const system = `You are an expert GitHub code review assistant, integrated into an automated CI pipeline. 
You produce summaries of pull requests for technical stakeholders including engineers, tech leads, and SREs. 
Your output is read by humans to quickly understand what the PR is doing, why it was made, and what its implications are.
Your tone is neutral and professional. You never guess. If something is unclear, omit it.
The output is typically used in release notes, review tools, and changelogs.`;

  const user = `Your task is to write a clear, precise, and insightful summary of a pull request.

Your summary should:
- Identify the purpose of the PR (feature, fix, refactor, infra, etc.).
- Infer *why* the change was made using signals from the title, description, commit messages, and code diff.
- Describe *how* the change was implemented (at a system/module level, not per file).
- Call out any breaking changes, implications, or deployment considerations.
- Use professional, concise language and a neutral tone.

Avoid:
- Repeating the PR title verbatim.
- Listing file paths or file names unless they're semantically important.
- Using vague phrases like "code improvements" or "update stuff."
- Making subjective or promotional statements.

---

✔️ **GOOD EXAMPLES**

**Infra**  
Adds a preview deployment workflow for main branch pushes. It introduces jobs for base, website, and blog previews, includes concurrency guards, and posts deployment statuses to GitHub. This improves CI transparency and deployment confidence.

**Bugfix**  
Fixes a memory leak in the \`TaskManager\` caused by circular references. The solution uses \`WeakMap\` for cleanup tracking and ensures listeners are properly disposed. This improves stability in long-running services.

**Refactor**  
Modularizes the authentication flow by splitting \`UserAuth\` into \`TokenService\`, \`SessionManager\`, and \`UserVerifier\`. This improves code isolation, testability, and aligns with microservice principles.

**Feature**  
Implements user-configurable dashboards using a grid layout engine. State is persisted via \`localStorage\`. This enables drag-and-resize layout personalization without backend dependency.

---

❌ **BAD EXAMPLES**

**Infra**  
This PR adds a new file to the CI workflows folder to enable preview deployments. It affects ci.yml and adds a few jobs. These steps let you preview things before they hit prod.

**Bugfix**  
The title says it's fixing memory issues and it changes how some listeners work. It uses weak references which are better and makes the app cleaner.

**Refactor**  
The code was messy so this PR cleans it up. It renames some stuff and adds a few utility files to split up functions. This will help engineers understand the code better.

**Feature**  
New feature to let people customize their dashboard. It saves some stuff and uses grid. Adds a better experience for users.

---

Now, summarize this pull request. Let’s think step by step: first, identify the type of change (feature, fix, refactor, infra, etc.). Then explain what changed and why. Finally, call out anything important for reviewers, deployers, or downstream teams.

**PR Title:**  
${prTitle}

**PR Description:**  
${prDescription}

**Files Affected:**  
${filesChanged}

**Commit Messages:**  
${commitMessages}

**Code Diff Summary:**  
${diffSummary}

Start your summary below:`;

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
  const { prompt } = createSummaryPrompt(
    filesChanged,
    prTitle,
    prDescription,
    commitMessages,
    diffSummary
  );

  try {
    const response = await openai.chat.completions.create({
      model: OPENAI_API_MODEL,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      temperature: 0.7,
      max_tokens: 4000,
      seed: 69,
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
