import styles from "./care.module.css";

export const SyncSummary = ({ mode, availability, state }: { mode: "manual" | "automatic"; availability: "available" | "unavailable"; state: "needs-input" | "syncing" | "complete" | "error" }) => (
  <section className={styles.syncSummary} aria-label="기록 상태">
    <strong>{mode === "manual" ? "직접 입력 사용 중" : availability === "available" ? "자동 동기화 준비" : "자동 동기화 사용할 수 없음"}</strong>
    <span>{state === "complete" ? "오늘의 계획을 기준으로 보여드려요." : state === "needs-input" ? "수면 목표를 입력하면 루틴을 만들 수 있어요." : state === "syncing" ? "기록을 확인하고 있어요." : "기록을 불러오지 못했어요."}</span>
  </section>
);
