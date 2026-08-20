import type { ManualInputCategory } from "../application/ports";
import styles from "./account.module.css";

export const ManualInputRules = ({ categories, idPrefix = "manual-rules" }: Readonly<{ categories: readonly ManualInputCategory[]; idPrefix?: string }>) => <section className={styles.rules} aria-labelledby={`${idPrefix}-title`}><h3 id={`${idPrefix}-title`}>수동 입력 기준</h3><p><strong>직접 입력 사용 중</strong> 자동 수집을 가정하지 않으며, 모든 항목은 사용자가 직접 기록합니다.</p><ul>{categories.map((category) => <li key={category.key}>{category.label}</li>)}</ul><p className={styles.rulesFootnote}>직접 입력 기록은 언제든 수정할 수 있어요.</p></section>;
