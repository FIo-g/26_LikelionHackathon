"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { acceptScheduleAdviceAction, dismissScheduleAdviceAction } from "@/app/(app)/plan/actions";
import type { ScheduleAdviceViewModel } from "../application/get-plan-view-model";
import { formatPlanDateTime } from "./format-plan-time";
import { ScheduleConfirmationDialog } from "./schedule-confirmation-dialog";
import styles from "./plan.module.css";

const confidenceLabel: Record<ScheduleAdviceViewModel["proposal"]["confidence"], string> = { low: "낮음", medium: "보통", high: "높음" };

export const ScheduleAdviceCard = ({ advice, timezone }: { advice: ScheduleAdviceViewModel; timezone: string }) => {
  const router = useRouter();
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const confirm = () => startTransition(async () => {
    try {
      setError(null);
      await acceptScheduleAdviceAction({ adviceId: advice.id, idempotencyKey: crypto.randomUUID() });
      setConfirmationOpen(false);
      router.refresh();
    } catch {
      setError("변경 내용을 반영하지 못했습니다. 다시 시도해 주세요.");
    }
  });

  return <section className={styles.adviceCard} aria-labelledby="schedule-advice-title">
    <div className={styles.sectionHeading}>
      <div><p className={styles.eyebrow}>{advice.triggerType === "reroute" ? "계획 조정 제안" : "수면 조정 제안"}</p><h2 id="schedule-advice-title">{advice.triggerType === "reroute" ? "기록된 활동에 맞춰 이후 계획을 조정해요" : advice.headline}</h2></div>
      <span>신뢰도 {confidenceLabel[advice.proposal.confidence]}</span>
    </div>
    <p>기상 목표: <time dateTime={advice.proposal.eventWakeAt}>{formatPlanDateTime(advice.proposal.eventWakeAt, timezone)}</time></p>
    {advice.status === "generated" ? <p>이 제안은 아직 계획에 반영되지 않았어요.</p> : null}
    {advice.triggerType === "reroute" ? <p>지나간 일정은 유지하고 이후 일정만 조정합니다.</p> : null}
    {advice.proposal.conflicts.length > 0 ? <p className={styles.warning}>조정 기간이 충분하지 않을 수 있어요.</p> : null}
    {advice.status === "generated" ? (
      <div className={styles.adviceActions}>
        <button type="button" onClick={() => setConfirmationOpen(true)}>계획에 반영</button>
        <form action={dismissScheduleAdviceAction}><input type="hidden" name="adviceId" value={advice.id} /><button type="submit">제안 닫기</button></form>
      </div>
    ) : null}
    {confirmationOpen ? <ScheduleConfirmationDialog
      title={`${advice.diff.length}일의 계획이 변경됩니다`}
      changes={advice.diff}
      timezone={timezone}
      confirmLabel="변경 확인 및 반영"
      pending={pending}
      error={error}
      onCancel={() => { if (!pending) setConfirmationOpen(false); }}
      onConfirm={confirm}
    /> : null}
  </section>;
};
