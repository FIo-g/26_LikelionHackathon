import Link from "next/link";
import { OnboardingProgress } from "@/modules/onboarding/ui/onboarding-progress";
import { createOnboardingRepository } from "@/modules/onboarding/infrastructure/prisma-onboarding-repository";
import { requireSessionUserId } from "@/shared/auth/require-session-user";
import styles from "@/modules/onboarding/ui/onboarding.module.css";
import { submitSleepGoalAction } from "./actions";

export default async function SleepGoalPage() {
  const userId = await requireSessionUserId();
  const repository = createOnboardingRepository(userId);
  const progress = await repository.getProgress();

  const bedTime = progress.sleepGoal?.targetBedTime ?? "23:00";
  const wakeTime = progress.sleepGoal?.targetWakeTime ?? "07:00";

  return (
    <main className={styles.onboardingLayout}>
      <section className={styles.onboardingCard}>
        <h1>수면 목표</h1>
        <OnboardingProgress currentStep={2} />
        <form action={submitSleepGoalAction} className={styles.onboardingForm}>
          <label className={styles.field}>
            취침 시간
            <input type="time" name="targetBedTime" defaultValue={bedTime} required />
          </label>
          <label className={styles.field}>
            기상 시간
            <input type="time" name="targetWakeTime" defaultValue={wakeTime} required />
          </label>
          <button type="submit" className={styles.cta}>다음</button>
        </form>

        <p className={styles.nav}>
          <Link href="/onboarding/connect">이전</Link>
        </p>
      </section>
    </main>
  );
}

