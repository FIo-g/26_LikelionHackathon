import type { DataBasis } from "../domain/types";
import styles from "./analyze.module.css";

type DataBasisPanelProps = Readonly<{
  dataBasis: DataBasis;
  id?: string;
}>;

export const DataBasisPanel = ({ dataBasis, id = "analysis-data-basis" }: DataBasisPanelProps) => (
  <section
    aria-labelledby={`${id}-title`}
    className={styles.dataBasisSection}
    id={id}
    tabIndex={-1}
  >
    <div className={styles.sectionHeading}>
      <p className={styles.eyebrow}>계산 로직</p>
      <h2 id={`${id}-title`}>분석에 반영된 데이터</h2>
    </div>
    <dl className={styles.dataBasisList}>
      <div><dt>기간</dt><dd>{dataBasis.periodStart && dataBasis.periodEnd ? `${dataBasis.periodStart}–${dataBasis.periodEnd}` : "기록을 기다리고 있어요"}</dd></div>
      <div><dt>표본</dt><dd>표본 {dataBasis.sampleCount}일</dd></div>
      <div><dt>알고리즘</dt><dd>{dataBasis.algorithmVersion}</dd></div>
      <div><dt>제외</dt><dd>{dataBasis.excludedCount}일</dd></div>
    </dl>
  </section>
);
