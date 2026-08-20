import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { narrationOutputSchema } from "../domain/narration-schema";
import { buildNarrationInput, NarrationProviderError, type NarrationFacts, type NarrationOutput } from "../domain/types";
import type { NarrationProvider } from "../application/ports";

const ALLOWED_MODEL = "gpt-5.6-terra" as const;

export type NarrationEnvironment = Readonly<{ apiKey: string; model: typeof ALLOWED_MODEL }>;

export const readNarrationEnvironment = (
  environment: Readonly<Record<string, string | undefined>> = process.env,
): NarrationEnvironment | null => {
  const apiKey = environment.OPENAI_API_KEY?.trim();
  const model = environment.OPENAI_MODEL?.trim();
  if (!apiKey || model !== ALLOWED_MODEL) return null;
  return { apiKey, model };
};

export class OpenAiNarrationProvider implements NarrationProvider {
  constructor(
    private readonly client: OpenAI,
    private readonly model: typeof ALLOWED_MODEL,
  ) {}

  async generate(input: NarrationFacts, signal: AbortSignal): Promise<NarrationOutput> {
    const response = await this.client.responses.parse({
      model: this.model,
      store: false,
      input: [
        { role: "system", content: "규칙 엔진의 사실만 설명하고 수치·날짜·인과관계를 새로 만들지 마세요." },
        { role: "user", content: JSON.stringify(buildNarrationInput(input)) },
      ],
      text: { format: zodTextFormat(narrationOutputSchema, "sleep_narration") },
    }, { signal });

    if (!response.output_parsed) throw new NarrationProviderError("UNPARSED_RESPONSE");
    return response.output_parsed;
  }
}

export const createOpenAiNarrationProvider = (
  environment: Readonly<Record<string, string | undefined>> = process.env,
): NarrationProvider | null => {
  const configured = readNarrationEnvironment(environment);
  return configured ? new OpenAiNarrationProvider(new OpenAI({ apiKey: configured.apiKey }), configured.model) : null;
};
