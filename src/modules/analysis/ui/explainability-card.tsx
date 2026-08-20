import type { EvidenceViewModel } from "../application/get-analyze-view-model";
import styles from "./analyze.module.css";

export const ExplainabilityCard = ({ evidence }: { evidence: readonly EvidenceViewModel[] }) => (
  <section aria-labelledby="explainability-title" className={styles.explainabilitySection}>
    <div className={styles.sectionHeading}>
      <p className={styles.eyebrow}>근거</p>
      <h2 id="explainability-title">이렇게 읽었어요</h2>
    </div>
    {evidence.length === 0 ? <p className={styles.emptyState}>표시할 근거를 준비하고 있어요.</p> : (
      <ul className={styles.evidenceList}>
        {evidence.map((item) => <li key={`${item.code}-${item.label}`}><strong>{item.label}</strong><span>{item.direction === "positive" ? "좋은 흐름" : "살펴볼 흐름"}</span></li>)}
      </ul>
    )}
  </section>
);
