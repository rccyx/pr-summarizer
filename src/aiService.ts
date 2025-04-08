import OpenAI from "openai";
import * as core from "@actions/core";

const OPENAI_API_KEY = core.getInput("OPENAI_API_KEY");
const OPENAI_API_MODEL =
  core.getInput("OPENAI_API_MODEL") || "gpt-4-turbo-preview";
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
  return `Please provide a concise summary of the following pull request changes.

Context:
- Files Changed: ${filesChanged}
- PR Title: ${prTitle}
- PR Description: ${prDescription}

Commit Messages:
${commitMessages}

Diff Summary:
${diffSummary}

Provide the summary in a short paragraph.`;
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
    const content =
      response.choices[0].message?.content?.trim() || "";
    return content || null;
  } catch (error) {
    core.warning(
      `AI API Error: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}




export const aiService = {
  getAISummary,
};
