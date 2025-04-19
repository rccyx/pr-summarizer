import OpenAI from "openai";
import * as core from "@actions/core";
import type { Optional } from "ts-roids";

function createSummaryPrompt(
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
  const system = `You are a senior staff-level code review assistant integrated into CI/CD pipelines. 
You summarize pull requests for stakeholders across engineering, SRE, and product teams. 
Your output informs changelogs, release notes, technical documentation, and review prioritization.
You think like an engineering lead: you understand architecture, care about why code changes, 
and write with precision and purpose. You never assume or guess; omit anything unclear.`;

  const user = `You are tasked with writing a high-quality summary of a pull request.

Think like a tech lead reviewing this PR in a real-world codebase.

Follow this step-by-step structure:

1. **Classify the type of change**: Choose from one of these categories: "Feature", "Bugfix", "Refactor", "Infra", "Docs", or "Chore".
2. **State the purpose** of the PR , what problem does this solve or what goal does it achieve?
3. **Explain the how**  describe implementation details at the architectural or module level (not per-file). Include patterns, decisions, or new abstractions.
4. **Call out important considerations**:
   - Breaking changes?
   - Migration steps?
   - Infra/CI impact?
   - Dependencies or downstream effects?

Write in a professional tone. Be concise but informative. Avoid filler words, repetition, or vague phrasing.

---

### ✅ GOOD OUTPUT EXAMPLES

**Feature**  
Adds a project tagging system to support multi-tag filtering in search and dashboard views. Introduces a 'TagManager' utility, updates the 'ProjectList' query, and adds UI components for tag controls.

**Bugfix**  
Resolves a bug where deleted users still appeared in activity logs. The fix updates the log serializer to check soft-delete flags before rendering user references.

**Refactor**  
Splits the monolithic payment handler into 'ChargeProcessor', 'RefundProcessor', and 'PaymentRouter'. This modularization simplifies future payment method integrations and improves test coverage.

**Infra**  
Introduces a GitHub Actions cache layer for pnpm dependencies. This reduces CI build time by 40% and avoids redundant installations across workflow jobs.

---

### ❌ BAD OUTPUT EXAMPLES

**Bugfix**  
Fixes an issue in logs. Now deleted users don't show up. Just checks for deleted flag.

**Feature**  
Added tags to projects. You can search with them. UI shows tags.

**Refactor**  
Cleaned up payment code. Broke it up a bit. Should be easier to maintain now.

---

This is the current information about the PR at your disposal:

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

Now, generate a high-quality summary, think step by step for this and no need to conclude at the end saying "Overall this PR..." when you are done, just say what's needed.

Begin your summary below:
`;

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
