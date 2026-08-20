import type { ManualInputCategory } from "../application/ports";
import styles from "./account.module.css";

export const ManualInputRules = ({ categories, idPrefix = "manual-rules" }: Readonly<{ categories: readonly ManualInputCategory[]; idPrefix?: string }>) => <section className={styles.rules} aria-labelledby={`${idPrefix}-title`}><h3 id={`${idPrefix}-title`}>직접 입력 항목</h3><p>자동 수집을 가정하지 않으며, 모든 항목은 사용자가 직접 기록합니다.</p><ul>{categories.map((category) => <li key={category.key}>{category.label}</li>)}</ul></section>;
