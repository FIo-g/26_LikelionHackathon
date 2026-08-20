import type { DataBasis } from "../domain/types";
import styles from "./analyze.module.css";

export const DataBasisPanel = ({ dataBasis }: { dataBasis: DataBasis }) => (
  <section aria-labelledby="data-basis-title" className={styles.dataBasisSection}>
    <div className={styles.sectionHeading}>
      <p className={styles.eyebrow}>계산 로직</p>
      <h2 id="data-basis-title">분석에 반영된 데이터</h2>
    </div>
    <dl className={styles.dataBasisList}>
      <div><dt>기간</dt><dd>{dataBasis.periodStart && dataBasis.periodEnd ? `${dataBasis.periodStart}–${dataBasis.periodEnd}` : "기록을 기다리고 있어요"}</dd></div>
      <div><dt>표본</dt><dd>표본 {dataBasis.sampleCount}일</dd></div>
      <div><dt>알고리즘</dt><dd>{dataBasis.algorithmVersion}</dd></div>
      <div><dt>제외</dt><dd>{dataBasis.excludedCount}일</dd></div>
    </dl>
  </section>
);
