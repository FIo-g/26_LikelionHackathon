import Link from "next/link";
import type { DisplayState } from "@/shared/domain/contracts";
import type { EntryPresence } from "@/modules/records/application/get-record-hub";
import type {
  RecordSummaryItem,
  RegionViewModel,
} from "@/modules/analysis/application/get-today-view-model";
import styles from "./today.module.css";

type RecordStatusSummaryProps = Readonly<{
  viewModel: RegionViewModel<RecordSummaryItem[]>;
}>;

const stateClassName: Record<DisplayState, string> = {
  ready: styles.regionReady,
  insufficient: styles.regionInsufficient,
  stale: styles.regionStale,
  error: styles.regionError,
};

const toActionLabel = (presence: EntryPresence): string => (
  presence === "completed" ? "수정하기" : presence === "draft" ? "마저 입력" : "기록하기"
);

const toStatusLabel = (presence: EntryPresence): string => (
  presence === "completed" ? "기록 완료" : presence === "draft" ? "작성 중" : "미기록"
);

export const RecordStatusSummary = ({ viewModel }: RecordStatusSummaryProps) => (
  <section className={`${styles.regionCard} ${stateClassName[viewModel.state]}`}>
    <h2 className={styles.regionTitle}>기록 요약</h2>
    <p className={styles.regionMessage}>오늘 기록 상태를 한눈에 확인</p>

    {viewModel.message ? <p className={styles.regionValue}>{viewModel.message}</p> : null}

    {viewModel.data === null ? (
      <p className={styles.regionMessage}>기록 데이터를 불러오지 못했습니다</p>
    ) : (
      <ul className={styles.recordList}>
        {viewModel.data.map((item) => (
          <li key={item.type} className={styles.recordItem}>
            <div className={styles.recordInfo}>
              <span>{item.label}</span>
              <strong>{toStatusLabel(item.presence)}</strong>
            </div>
            <Link href={item.href} className={styles.linkButton}>
              {toActionLabel(item.presence)}
            </Link>
          </li>
        ))}
      </ul>
    )}

    {viewModel.action ? (
      <Link href={viewModel.action.href} className={styles.primaryButton}>
        {viewModel.action.label}
      </Link>
    ) : null}
  </section>
);
