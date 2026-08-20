import { getRecordHub } from "@/modules/records/application/get-record-hub";
import { RecordCategoryCard } from "@/modules/records/ui/record-category-card";
import { requireUserScope } from "@/shared/auth/require-user-scope";
import styles from "@/modules/records/ui/records.module.css";

const pageTitles: Record<string, string> = {
  caffeine: "카페인",
  alcohol: "음주",
  meal: "식사/운동/컨디션",
  sleep: "수면/휴대폰",
};

export default async function RecordHubPage() {
  const userScope = await requireUserScope();
  const { categories } = await getRecordHub(userScope);

  return (
    <main className={styles.recordPage}>
      <h1 className={styles.recordTitle}>기록</h1>
      <div className={styles.recordGrid}>
        {categories.map((category) => (
          <section key={category.type} className={styles.categoryCard}>
            <h2>{pageTitles[category.type]}</h2>
            <RecordCategoryCard
              category={category.label}
              presence={category.presence}
              inputMode={category.inputMode}
              summary={category.summary}
              href={category.href}
            />
          </section>
        ))}
      </div>
    </main>
  );
}
