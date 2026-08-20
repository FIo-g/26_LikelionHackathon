import Link from "next/link";
import type { DisplayState } from "@/shared/domain/contracts";
import type {
  DataStatusViewModel,
  RegionViewModel,
} from "@/modules/analysis/application/get-today-view-model";
import styles from "./today.module.css";

type DataStatusCardProps = Readonly<{
  viewModel: RegionViewModel<DataStatusViewModel>;
}>;

const stateClassName: Record<DisplayState, string> = {
  ready: styles.regionReady,
  insufficient: styles.regionInsufficient,
  stale: styles.regionStale,
  error: styles.regionError,
};

export const DataStatusCard = ({ viewModel }: DataStatusCardProps) => {
  const completed = viewModel.data?.completedCategories ?? 0;
  const total = viewModel.data?.totalCategories ?? 0;
  const missing = viewModel.data?.missingLabels ?? [];

  return (
    <section className={`${styles.regionCard} ${stateClassName[viewModel.state]}`}>
      <h2 className={styles.regionTitle}>오늘의 데이터 상태</h2>

      {viewModel.data === null ? (
        <p className={styles.regionMessage}>{viewModel.message ?? "데이터 기준이 부족합니다"}</p>
      ) : (
        <>
          <p className={styles.dataStatusPill}>{completed}/{total} 항목 기준 충족</p>
          {missing.length > 0 ? (
            <ul className={styles.missingList}>
              {missing.map((label) => (
                <li key={label}>{label} 미기록</li>
              ))}
            </ul>
          ) : null}
        </>
      )}

      {viewModel.message && viewModel.data !== null ? <p className={styles.regionMessage}>{viewModel.message}</p> : null}
      {viewModel.action ? (
        <Link href={viewModel.action.href} className={styles.linkButton}>
          {viewModel.action.label}
        </Link>
      ) : null}
    </section>
  );
};
