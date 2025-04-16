import OpenAI from "openai";
import * as core from "@actions/core";

export function createSummaryPrompt(
  filesChanged: string,
  prTitle: string,
  prDescription: string,
  commitMessages: string,
  diffSummary: string
): string {
  return `You are a GitHub code review assistant. Your task is to write a clear, precise, and insightful summary of a pull request. 

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

Use the examples below as guidance.

---
✔️ **GOOD EXAMPLE** (Infra / CI feature):

This PR adds a preview deployment workflow for changes pushed to the main branch. It introduces three new jobs—base, website, and blog preview deployments—with concurrency controls and GitHub notification steps. These changes enable better staging verification and streamline the CI/CD flow.

---
❌ **BAD EXAMPLE** (Shallow, verbose, file-based):

This PR titled "ci: add preview on main" changes .github/workflows/ci.yml and adds preview steps to the CI pipeline. This is done to allow previewing changes before they go to production and improve the development process overall.
---

Now, summarize this pull request, let's think step by step. First, we identify what kind of change this is (refactor, infra), then we explain what was added or modified. Finally, we mention what benefit or downstream impact this has.

**PR Title:**  
${prTitle}

**PR Description:**  
${prDescription}

**Files Changed:**  
${filesChanged}

**Commit Messages:**  
${commitMessages}

**Code Diff Summary:**  
${diffSummary}

Start your summary below:
`;
}

const OPENAI_API_KEY = core.getInput("OPENAI_API_KEY");
const OPENAI_API_MODEL = core.getInput("OPENAI_API_MODEL") ?? "gpt-4o";

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

export async function getAISummary(prompt: string): Promise<string | null> {
  try {
    const response = await openai.chat.completions.create({
      model: OPENAI_API_MODEL,
      messages: [{ role: "user", content: prompt }],
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
