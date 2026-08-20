import Link from "next/link";
import { OnboardingProgress } from "@/modules/onboarding/ui/onboarding-progress";
import { createOnboardingRepository } from "@/modules/onboarding/infrastructure/prisma-onboarding-repository";
import { requireSessionUserId } from "@/shared/auth/require-session-user";
import styles from "@/modules/onboarding/ui/onboarding.module.css";
import { submitHabitsAction } from "./actions";

const HABIT_OPTIONS = {
  caffeine: [
    { label: "없음", value: "none" },
    { label: "가끔", value: "sometimes" },
    { label: "매일", value: "daily" },
  ],
  exercise: [
    { label: "거의 없음", value: "rare" },
    { label: "주 1~2회", value: "weekly" },
    { label: "자주 함", value: "frequent" },
  ],
  meal: [
    { label: "빨리 끝", value: "early" },
    { label: "보통", value: "mixed" },
    { label: "늦게", value: "late" },
  ],
  phoneUsage: [
    { label: "낮음", value: "low" },
    { label: "보통", value: "medium" },
    { label: "높음", value: "high" },
  ],
} as const;

export default async function HabitsPage() {
  const userId = await requireSessionUserId();
  const repository = createOnboardingRepository(userId);
  const progress = await repository.getProgress();

  const habits = progress.habits;

  return (
    <main className={styles.onboardingLayout}>
      <section className={styles.onboardingCard}>
        <h1>현재 습관</h1>
        <OnboardingProgress currentStep={3} />
        <form action={submitHabitsAction} className={styles.onboardingForm}>
          <label className={styles.field}>
            커피/카페인
            <select name="caffeine" defaultValue={habits?.caffeine ?? "none"} required>
              {HABIT_OPTIONS.caffeine.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>

          <label className={styles.field}>
            운동 빈도
            <select name="exercise" defaultValue={habits?.exercise ?? "rare"} required>
              {HABIT_OPTIONS.exercise.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>

          <label className={styles.field}>
            식사 패턴
            <select name="meal" defaultValue={habits?.meal ?? "mixed"} required>
              {HABIT_OPTIONS.meal.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>

          <label className={styles.field}>
            휴대폰 사용
            <select name="phoneUsage" defaultValue={habits?.phoneUsage ?? "low"} required>
              {HABIT_OPTIONS.phoneUsage.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>

          <button type="submit" className={styles.cta}>다음</button>
        </form>

        <p className={styles.nav}>
          <Link href="/onboarding/sleep-goal">이전</Link>
        </p>
      </section>
    </main>
  );
}

