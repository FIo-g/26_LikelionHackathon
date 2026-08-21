import OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";
import { narrationOutputSchema } from "@/modules/narration/domain/narration-schema";
import type { NarrationFacts, NarrationOutput } from "@/modules/narration/domain/types";
import { OpenAiNarrationProvider } from "@/modules/narration/infrastructure/openai-narration-provider";

const facts: NarrationFacts = {
  target: { kind: "analysis", id: "snapshot-1" },
  algorithmVersion: "provisional-v1",
  metrics: [{ id: "readiness", value: 60, band: "보통" }],
  dataBasis: {
    periodStart: "2026-08-15",
    periodEnd: "2026-08-21",
    sampleCount: 7,
    excludedCount: 0,
    missingFields: [],
    sourceDistribution: { manual: 7 },
  },
  evidence: [{ code: "PHONE_LATE", direction: "negative", count: 2 }],
  event: null,
  proposal: null,
  confidence: "medium",
};

const parsedOutput: NarrationOutput = {
  headline: "오늘의 수면 준비 상태를 확인해 보세요.",
  body: "입력된 기록과 지표를 바탕으로 수면 준비 상태를 살펴보세요.",
  bullets: ["오늘 기록을 이어서 확인해 보세요."],
};

describe("OpenAiNarrationProvider", () => {
  it("instructs the model not to invent numeric, date, or causal claims", async () => {
    const parse = vi.fn().mockResolvedValue({ output_parsed: parsedOutput });
    const client = { responses: { parse } } as unknown as OpenAI;
    const provider = new OpenAiNarrationProvider(client, "gpt-5.6-luna");
    const signal = new AbortController().signal;

    const output = await provider.generate(facts, signal);

    expect(narrationOutputSchema.safeParse(output).success).toBe(true);
    expect(parse).toHaveBeenCalledOnce();
    const [request, requestOptions] = parse.mock.calls[0] as [
      { input: readonly { role: string; content: string }[] },
      { signal: AbortSignal },
    ];
    const systemPrompt = request.input.find((message) => message.role === "system")?.content;

    expect(requestOptions.signal).toBe(signal);
    expect(systemPrompt).toEqual(expect.stringMatching(/(?:숫자|수치).*(?:날짜)|(?:날짜).*(?:숫자|수치)/));
    expect(systemPrompt).toEqual(expect.stringMatching(/(?:입력|제공).*(?:facts|사실).*(?:그대로|명시|인용).*(?:경우에만|외|제외)/i));
    expect(systemPrompt).toEqual(expect.stringMatching(/(?:숫자|수치|날짜).*(?:피하|사용하지|금지)/));
    expect(systemPrompt).toEqual(expect.stringMatching(/(?:입력|제공).*(?:facts|사실).*(?:없는|없는 경우).*(?:숫자|수치).*(?:날짜).*(?:절대|새로).*(?:만들|발명|지어내)/i));
    expect(systemPrompt).toEqual(expect.stringMatching(/(?:원인|결과|효과|진단|인과).*(?:추정하지|주장하지|단정하지|만들지)/));
  });
});
