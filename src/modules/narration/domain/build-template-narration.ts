import type { NarrationFacts, NarrationOutput } from "./types";

export const buildTemplateNarration = (facts: NarrationFacts): NarrationOutput => {
  if (facts.target.kind === "analysis") {
    const readiness = facts.metrics.find((metric) => metric.id === "readiness")?.value;
    return {
      headline: "현재 기록으로 본 수면 준비 상태",
      body: readiness === null || readiness === undefined
        ? "현재 기록에서 수면 준비 점수는 계산하지 않았어요. 기록된 패턴을 바탕으로 다음 기록을 살펴볼 수 있어요."
        : `현재 기록에서 수면 준비 상태는 ${readiness}점으로 정리되었어요. 이는 기록된 패턴을 바탕으로 한 초기 추정입니다.`,
      bullets: [
        `최근 ${facts.dataBasis.sampleCount}일 기록을 사용했어요.`,
        "기록이 쌓이면 관찰된 패턴을 더 자세히 보여드려요.",
      ],
    };
  }

  return {
    headline: "일정에 맞춘 수면 계획",
    body: "현재 목표와 일정 정보를 바탕으로 수면 계획을 정리했어요.",
    bullets: [
      `계획은 ${facts.proposal?.days.length ?? 0}일에 적용돼요.`,
      "수정 전 내용을 확인한 뒤 적용할 수 있어요.",
    ],
  };
};
