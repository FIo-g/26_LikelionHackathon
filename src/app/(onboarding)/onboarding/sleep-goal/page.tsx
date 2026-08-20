import Image from "next/image";
import { OnboardingProgress } from "@/modules/onboarding/ui/onboarding-progress";
import { createOnboardingRepository } from "@/modules/onboarding/infrastructure/prisma-onboarding-repository";
import { requireSessionUserId } from "@/shared/auth/require-session-user";
import styles from "@/modules/onboarding/ui/onboarding.module.css";
import { SleepGoalEditor } from "@/modules/onboarding/ui/sleep-goal-editor";
import { submitSleepGoalAction } from "./actions";
import { redirectIfOnboardingPrerequisiteIsMissing } from "../flow";

export default async function SleepGoalPage() {
  const userId = await requireSessionUserId();
  const repository = createOnboardingRepository(userId);
  const progress = await repository.getProgress();
  redirectIfOnboardingPrerequisiteIsMissing(progress, "sleep-goal");

  const bedTime = progress.sleepGoal?.targetBedTime ?? "23:30";
  const wakeTime = progress.sleepGoal?.targetWakeTime ?? "07:00";

  return (
    <main className={styles.onboardingLayout}>
      <section className={styles.onboardingCard}>
        <OnboardingProgress currentStep={3} previousHref="/onboarding/habits" />
        <div className={styles.onboardingBody}>
          <h1>어떤 밤을 만들고 싶나요?</h1>
          <p className={styles.lead}>목표 취침·기상 시간을 기준으로 오늘의 준비 시간을 계산해요.</p>
          <form action={submitSleepGoalAction} className={styles.onboardingForm}>
            <SleepGoalEditor targetBedTime={bedTime} targetWakeTime={wakeTime} />

            <p className={styles.scheduleHint}>주요 일정이 생기면 이후 계획 화면에서 추가할 수 있어요.</p>

            <aside className={`${styles.rabbitNote} ${styles.goalReassurance}`}>
              <p>처음 설정한 시간은 언제든 바꿀 수 있어요.<br />기록과 일정이 쌓이면 무리 없는 조정안을 제안합니다.</p>
              <span><Image src="/assets/lunar-rabbit/care-rabbit.png" alt="" width={82} height={82} /></span>
            </aside>

            <button type="submit" className={styles.cta}>다음</button>
          </form>
        </div>
      </section>
    </main>
  );
}
