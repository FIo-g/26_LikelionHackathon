import { getRecordHub } from "@/modules/records/application/get-record-hub";
import { requireUserScope } from "@/shared/auth/require-user-scope";
import { RecordCategoryCard } from "@/modules/records/ui/record-category-card";
import styles from "@/modules/records/ui/records.module.css";

const formatRecordDate = (timezone: string) => new Intl.DateTimeFormat("ko-KR", {
  timeZone: timezone,
  month: "long",
  day: "numeric",
  weekday: "long",
}).format(new Date());

const displayCategoryLabel = (type: string, label: string): string => {
  if (type === "alcohol") return "알코올";
  if (type === "meal") return "식사 · 운동 · 컨디션";
  return label;
};

export default async function RecordHubPage() {
  const userScope = await requireUserScope();
  const { categories } = await getRecordHub(userScope);
  const today = formatRecordDate(userScope.timezone);
  const sleepCategory = categories.find((category) => category.type === "sleep");
  const todayCategories = categories.filter((category) => category.type !== "sleep");

  return (
    <main className={styles.recordPage} data-lunar-screen="record">
      <header className={styles.recordHero}>
        <p className={styles.recordEyebrow}>RECORD · 오늘 {today}</p>
        <h1 className={styles.recordTitle}>오늘의 생활 기록</h1>
        <p className={styles.recordSubtitle}>저장된 기록을 확인하고, 빠진 항목만 직접 기록하세요.</p>
      </header>

      <section className={styles.recordContent} aria-labelledby="record-today-title">
        <aside className={styles.recordGuidance} aria-label="기록 안내">
          <span className={styles.categoryIcon} aria-hidden="true">직</span>
          <div>
            <strong>모든 기록은 직접 확인해 저장해요</strong>
            <p>기기에 연결되지 않아도 오늘의 수치를 빠짐없이 입력할 수 있어요.</p>
          </div>
        </aside>

        <div className={styles.dateBar}>
          <span>기록 기준일</span>
          <strong>오늘 · {today}</strong>
          <small>수면만 어젯밤 기준</small>
        </div>

        <div className={styles.sectionHeading}>
          <h2 id="record-today-title">오늘 기록</h2>
          <p>카페인 · 알코올 · 식사 · 운동 · 컨디션</p>
        </div>
        <div className={styles.recordGrid}>
          {todayCategories.map((category) => (
            <RecordCategoryCard
              key={category.type}
              category={displayCategoryLabel(category.type, category.label)}
              presence={category.presence}
              inputMode={category.inputMode}
              summary={category.summary}
              href={category.href}
              records={category.records}
              editDraft={category.editDraft}
            />
          ))}
        </div>

        {sleepCategory ? (
          <section className={styles.sleepSection} aria-labelledby="sleep-record-title">
            <h2 id="sleep-record-title">어젯밤 수면</h2>
            <RecordCategoryCard
              category="어젯밤 수면 · 오늘 휴대폰"
              presence={sleepCategory.presence}
              inputMode={sleepCategory.inputMode}
              summary={sleepCategory.summary}
              href={sleepCategory.href}
              records={sleepCategory.records}
              editDraft={sleepCategory.editDraft}
              featured
            />
          </section>
        ) : null}
      </section>
    </main>
  );
}
