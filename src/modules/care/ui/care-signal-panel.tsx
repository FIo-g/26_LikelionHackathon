import Link from "next/link";
import type { PlanDayTarget } from "@/modules/planner/domain/types";
import styles from "./care.module.css";

type CareSignalPanelProps = Readonly<{
  inputState: "needs-input" | "complete";
  planDay: PlanDayTarget | null;
  rerouteAdvice: Readonly<{ id: string }> | null;
  phonePattern: Readonly<{ sampleCount: number; averageDurationMinutes: number }> | null;
  tomorrowPlan: PlanDayTarget | null;
  timezone: string;
}>;

const formatTime = (value: string, timezone: string): string => new Intl.DateTimeFormat("ko-KR", {
  timeZone: timezone,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
}).format(new Date(value));

export const CareSignalPanel = ({ inputState, planDay, rerouteAdvice, phonePattern, tomorrowPlan, timezone }: CareSignalPanelProps) => (
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
    {rerouteAdvice ? (
      <section aria-label="계획 조정 제안" className={styles.signalDataCard}>
        <p className={styles.signalDataEyebrow}>계획 조정</p>
        <h3>새 조정 제안이 있어요</h3>
        <p>기록을 반영해 이후 계획만 조정합니다.</p>
        <Link className={styles.signalDataLink} href="/plan">계획에서 확인</Link>
      </section>
    ) : null}
    {phonePattern ? (
      <section aria-label="휴대폰 패턴" className={styles.signalDataCard}>
        <p className={styles.signalDataEyebrow}>휴대폰 패턴</p>
        <h3>최근 {phonePattern.sampleCount}일 평균 {phonePattern.averageDurationMinutes}분</h3>
        <p>직접 입력한 취침 전 휴대폰 사용 기록을 요약했어요.</p>
      </section>
    ) : null}
    {tomorrowPlan ? (
      <section aria-label="다음 수면 계획" className={styles.signalDataCard}>
        <p className={styles.signalDataEyebrow}>다음 수면 계획</p>
        <h3>취침 {formatTime(tomorrowPlan.targetBedAt, timezone)} · 기상 {formatTime(tomorrowPlan.targetWakeAt, timezone)}</h3>
        <p>저장된 계획 기준이에요.</p>
        <Link className={styles.signalDataLink} href="/plan">계획 보기</Link>
      </section>
    ) : null}
  </div>
);
