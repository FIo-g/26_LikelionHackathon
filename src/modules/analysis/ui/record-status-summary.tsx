import Image from "next/image";
import Link from "next/link";
import type { DisplayState } from "@/shared/domain/contracts";
import type { EntryPresence } from "@/modules/records/application/get-record-hub";
import type {
  RecordSummaryItem,
  RegionViewModel,
} from "@/modules/analysis/application/get-today-view-model";
import styles from "./today.module.css";

type RecordStatusSummaryProps = Readonly<{
  viewModel: RegionViewModel<readonly RecordSummaryItem[]>;
}>;

const stateClassName: Record<DisplayState, string> = {
  ready: styles.regionReady,
  insufficient: styles.regionInsufficient,
  stale: styles.regionStale,
  error: styles.regionError,
};

const toActionLabel = (presence: EntryPresence): string => (
  presence === "completed" ? "추가 기록" : presence === "draft" ? "마저 입력" : "기록하기"
);

const toStatusLabel = (presence: EntryPresence): string => (
  presence === "completed" ? "기록 완료" : presence === "draft" ? "작성 중" : "미기록"
);

export const RecordStatusSummary = ({ viewModel }: RecordStatusSummaryProps) => {
  return (
    <section className={`${styles.regionCard} ${styles.recordSummary} ${stateClassName[viewModel.state]}`}>
      <h2 className={styles.regionTitle}>오늘의 기록</h2>
      <p className={styles.regionMessage}>각 항목의 실제 입력 상태를 한눈에 확인해요.</p>

      {viewModel.message ? <p className={styles.regionValue}>{viewModel.message}</p> : null}

      {viewModel.data === null ? (
        <p className={styles.regionMessage}>기록 데이터를 불러오지 못했습니다</p>
      ) : (
        <ul className={styles.recordList}>
          {viewModel.data.map((item) => {
            const needsSleep = item.type === "sleep" && item.presence !== "completed";
            return (
              <li key={item.type} className={`${styles.recordItem} ${needsSleep ? styles.recordItemSleep : ""}`}>
                {needsSleep ? (
                  <Image
                    alt="피곤한 달토끼"
                    className={styles.sleepRabbit}
                    height={88}
                    src="/assets/lunar-rabbit/today-sleep-deprived.png"
                    width={88}
                  />
                ) : <span aria-hidden="true" className={styles.recordIcon}>{item.label.slice(0, 1)}</span>}
                <div className={styles.recordInfo}>
                  <span>{needsSleep ? "어젯밤 수면 기록이 필요해요" : item.label}</span>
                  <strong>{needsSleep ? "기상 후 어제 기준으로 직접 입력해요." : toStatusLabel(item.presence)}</strong>
                </div>
                <Link href={item.href} className={styles.linkButton}>
                  {needsSleep ? "수면 기록 추가" : toActionLabel(item.presence)}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {viewModel.action ? (
        <Link href={viewModel.action.href} className={styles.primaryButton}>
          {viewModel.action.label}
        </Link>
      ) : null}
    </section>
  );
};
