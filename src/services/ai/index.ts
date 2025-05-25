import { Optional } from "ts-roids";
import OpenAI from "openai";
import { createRichSummaryPrompt } from "./prompts";
import type { PrData } from "../../types/index

type OpenAIModel = "gpt-4o" | "gpt-3.5-turbo";

export class AiService {
  private openai: OpenAI;
  private model: OpenAIModel;
  constructor({
    apiKey,
    model = "gpt-4o",
  }: {
    apiKey: string;
    model?: OpenAIModel;
  }) {
    this.openai = new OpenAI({ apiKey });
    this.model = model;
  }

  public async getAiSummary(input: PrData): Promise<Optional<string>> {
    const { prompt } = this.getPrompt(input);
    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      temperature: 0.3,
      max_tokens: 4096,
      seed: 69,
    });
    return response.choices[0].message?.content?.trim() ?? null;
  }

  private getPrompt(input: PrData): {
    prompt: { system: string; user: string };
  } {
    return createRichSummaryPrompt({
      prTitle: input.prTitle,
      prDescription: input.prDescription,
      commitMessages: input.commitMessages,
      diffSummary: input.diffSummary,
    });
  }
}
