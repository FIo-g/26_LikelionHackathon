import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { narrationOutputSchema } from "../domain/narration-schema";
import { buildNarrationInput, NarrationProviderError, type NarrationFacts, type NarrationOutput } from "../domain/types";
import type { NarrationProvider } from "../application/ports";

const ALLOWED_MODEL = "gpt-5.6-luna" as const;

const NARRATION_SYSTEM_INSTRUCTIONS = [
  "입력 facts에 있는 정보만 설명하세요.",
  "숫자나 날짜 표현은 입력 facts에서 그대로 복사할 수 있는 경우에만 사용하고, 가능하면 숫자·날짜 표현 자체를 피하세요.",
  "입력 facts에 없는 숫자, 날짜, 기간, 순위, 비교 결과를 절대 만들지 마세요.",
  "입력에 포함된 지표, 등급, 근거만 서술하고 원인·결과·효과·진단 같은 인과관계를 추정하지 마세요.",
].join(" ");

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
        { role: "system", content: NARRATION_SYSTEM_INSTRUCTIONS },
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
