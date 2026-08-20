import styles from "./care.module.css";

/**
 * ASMR source audio is not bundled with the app yet. Keep the Figma tool slot
 * visible without implying that an unavailable sound can be played or saved.
 */
export const AsmrUnavailableCard = () => (
  <article aria-label="ASMR 음원 준비 중" className={`${styles.toolCard} ${styles.toolUnavailableCard}`}>
    <div className={styles.toolCardHeader}>
      <span className={styles.toolIcon} aria-hidden="true">♪</span>
      <div className={styles.toolCopy}>
        <h3>ASMR</h3>
        <p>지원 음원을 준비하고 있어요.</p>
      </div>
    </div>
    <span className={styles.toolAvailability}>준비 중</span>
  </article>
);
