import OpenAI from "openai";
import * as core from "@actions/core";

const OPENAI_API_KEY = core.getInput("OPENAI_API_KEY");
const OPENAI_API_MODEL = core.getInput("OPENAI_API_MODEL") ?? "gpt-4o";
const MAX_TOKENS = 4000;

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

export function createSummarySystemPrompt(): string {
  return `You are an expert code summarizer. Your task is to produce a concise summary of a pull request's changes in a few sentences.
Include key aspects such as which files were affected, the intent behind the changes, and any notable impact. Do not include extraneous commentary.`;
}

export function createSummaryPrompt(
  filesChanged: string,
  prTitle: string,
  prDescription: string,
  commitMessages: string,
  diffSummary: string
): string {
  return `You are a senior software engineer and technical writer tasked with generating a high-quality GitHub pull request description based on provided metadata.

Your job is to analyze the full context — title, commits, file changes, and diff summary — and write a clear, detailed, and professional pull request body.

## Goals
Produce a PR description that explains:
- What was changed
- Why it was changed (based on title, description, and commits)
- How it was implemented
- Any significant impacts (e.g., breaking changes, performance, behavior)
- Any relevant tests, validations, or rollout considerations

## Output Format
Write in Markdown, using sections if helpful. Follow this rough structure:

### Summary  
Briefly explain the purpose of the PR.

### Changes  
List or describe the key technical changes made. Use bullet points or short paragraphs.

### Rationale  
Explain the motivation behind the change, or the problem it solves.

### Impact  
Note any side effects, risks, backwards-incompatible changes, or follow-ups.

### Testing  
Mention what was tested or how reviewers can verify the changes.

---

## Provided Context

**Original PR Title:**  
${prTitle}

**PR Description (if any):**  
${prDescription}

**Files Changed:**  
${filesChanged}

**Commit Messages:**  
${commitMessages}

**Diff Summary:**  
${diffSummary}

---

Write the full PR description now. Use clear language, structure, and focus on technical clarity. Do not repeat the title verbatim.`;
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
