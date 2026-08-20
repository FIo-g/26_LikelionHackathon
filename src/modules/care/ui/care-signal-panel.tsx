import type { PlanDayTarget } from "@/modules/planner/domain/types";
import styles from "./care.module.css";

type CareSignalPanelProps = Readonly<{
  inputState: "needs-input" | "complete";
  planDay: PlanDayTarget | null;
  timezone: string;
}>;

const formatTime = (value: string, timezone: string): string => new Intl.DateTimeFormat("ko-KR", {
  timeZone: timezone,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
}).format(new Date(value));

export const CareSignalPanel = ({ inputState, planDay, timezone }: CareSignalPanelProps) => (
  <div className={styles.signalPanel}>
    <dl>
      <div className={styles.signalItem}>
        <dt className={styles.signalLabel}>기록 방식</dt>
        <dd className={styles.signalValue}>직접 입력</dd>
      </div>
      <div className={styles.signalItem}>
        <dt className={styles.signalLabel}>입력 상태</dt>
        <dd className={styles.signalValue}>{inputState === "complete" ? "오늘 계획 준비됨" : "수면 목표 입력 필요"}</dd>
      </div>
      <div className={styles.signalItem}>
        <dt className={styles.signalLabel}>오늘 계획</dt>
        <dd className={styles.signalValue}>
          {planDay
            ? `취침 ${formatTime(planDay.targetBedAt, timezone)} · 기상 ${formatTime(planDay.targetWakeAt, timezone)}`
            : "수면 목표 입력 후 표시"}
        </dd>
      </div>
    </dl>
    <p className={styles.signalPrinciple}>
      자동 동기화를 가정하지 않고, 직접 입력한 수면 목표와 계획만 사용해요.
    </p>
  </div>
);
