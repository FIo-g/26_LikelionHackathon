import styles from "./care.module.css";

type SyncSummaryProps = Readonly<{
  mode: "manual" | "automatic";
  availability: "available" | "unavailable";
  state: "needs-input" | "syncing" | "complete" | "error";
}>;

const syncTitle = ({ mode, availability }: Pick<SyncSummaryProps, "mode" | "availability">): string => {
  if (mode === "manual") return "직접 입력 사용 중";
  return availability === "available" ? "자동 동기화 준비" : "자동 동기화 사용할 수 없음";
};

const syncMessage: Record<SyncSummaryProps["state"], string> = {
  complete: "오늘의 계획을 기준으로 보여드려요.",
  "needs-input": "수면 목표를 입력하면 루틴을 만들 수 있어요.",
  syncing: "기록을 확인하고 있어요.",
  error: "기록을 불러오지 못했어요.",
};

export const SyncSummary = ({ mode, availability, state }: SyncSummaryProps) => (
  <section className={styles.syncSummary} aria-label="기록 상태" data-sync-mode={mode} data-sync-state={state}>
    <div className={styles.syncSummaryTitle}>
      <span aria-hidden="true" className={styles.syncIndicator} />
      <strong>{syncTitle({ mode, availability })}</strong>
    </div>
    <span className={styles.syncSummaryMessage}>{syncMessage[state]}</span>
  </section>
);
