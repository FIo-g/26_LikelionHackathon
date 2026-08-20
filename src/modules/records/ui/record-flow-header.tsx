import Link from "next/link";
import styles from "./records.module.css";

type RecordFlowHeaderProps = Readonly<{
  section: string;
}>;

export const RecordFlowHeader = ({ section }: RecordFlowHeaderProps) => (
  <header className={styles.flowHeader}>
    <p className={styles.flowStatus} aria-hidden="true">9:41</p>
    <Link className={styles.flowBack} href="/record" aria-label="기록 화면으로 돌아가기">
      <span aria-hidden="true">‹</span>
      기록 · {section}
    </Link>
  </header>
);
